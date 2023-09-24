import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";
import * as gc from "./gc.js";
import * as subset from "./subset.js";

function harvest_matrices(x) {
    let output = utils.createBigUint64WasmArray(x.length);
    let arr = output.array();
    for (var i = 0; i < x.length; i++) {
        arr[i] = BigInt(x[i].matrix.$$.ptr);
    }
    return output;
}

/**
 * Combine matrices by column, where all matrices contain data for the same features, in the same order.
 *
 * @param {Array} inputs - Array of one or more {@linkplain ScranMatrix} objects.
 * All of these should have the same number and order of features.
 *
 * @return {ScranMatrix} A {@linkplain ScranMatrix} containing the matrices after combining them by column.
 */
export function cbind(inputs) {
    let mat_ptrs;
    let output;

    try {
        mat_ptrs = harvest_matrices(inputs);
        output = gc.call(
            module => module.cbind(mat_ptrs.length, mat_ptrs.offset),
            ScranMatrix
        );
    } catch (e) {
        utils.free(output);
        throw e;
    } finally {
        utils.free(mat_ptrs);
    }

    return output;
}

/**
 * Combine matrices by row, where all matrices contain data for the same cells, in the same order.
 *
 * @param {Array} inputs - Array of one or more {@linkplain ScranMatrix} objects.
 * All of these should have the same number and order of cells.
 *
 * @return {ScranMatrix} A {@linkplain ScranMatrix} containing the matrices after combining them by row.
 */
export function rbind(inputs) {
    let mat_ptrs;
    let output;

    try {
        mat_ptrs = harvest_matrices(inputs);
        output = gc.call(
            module => module.rbind(mat_ptrs.length, mat_ptrs.offset),
            ScranMatrix
        );
    } catch (e) {
        utils.free(output);
        throw e;
    } finally {
        utils.free(mat_ptrs);
    }

    return output;
}


/**
 * Combine matrices by column, after subsetting each matrix to the intersection of common features.
 *
 * @param {Array} inputs - Array of one or more {@linkplain ScranMatrix} objects.
 * @param {Array} names - Array of length equal to `inputs`.
 * Each entry should be an Array containing the row names of the corresponding entry of `inputs`.
 * Names should correspond to the rows of that entry of `inputs`.
 * Any `null` names are ignored.
 * If names are duplicated within each array, only the first occurrence is considered in the intersection.
 *
 * @return {object} An object containing:
 * - `matrix`, a {@linkplain ScranMatrix} containing the combined matrices.
 * - `indices`, an Int32Array of length equal to the number of rows in `matrix`.
 *    This contains the index of the row in the first entry of `inputs` corresponding to each row of `matrix`,
 *    i.e., the gene at the `i`-th row of `matrix` is the same as the gene at the `indices[i]`-th row of `inputs[0]`.
 *    This is guaranteed to be sorted.
 * - `names`, an array of names identifying the rows of `matrix`.
 *    This is constructed by indexing the first entry of `names` with `indices`.
 */
export function cbindWithNames(x, names) {
    // Find the intersection of names, following the order of the first entry.
    // We do so to try to improve the chance of getting an ordered subset for efficient extraction.
    let ordered_intersection = [];
    let remapping = new Map;

    if (names.length > 0) {
        let intersection = new Set;
        for (var n = 0; n < names.length; ++n) {
            let current = new Set();
            for (const name of names[n]) {
                if (name !== null) {
                    if (n == 0 || intersection.has(name)) {
                        current.add(name);
                    }
                }
            }
            intersection = current;
        }

        for (const name of names[0]) {
            if (name !== null && intersection.has(name)) {
                let candidate = remapping.get(name);
                if (candidate == undefined) { // only consider the first occurence.
                    remapping.set(name, ordered_intersection.length);
                    ordered_intersection.push(name);
                }
            }
        }
    }

    // Actually generating the combined matrix.
    let output = {};
    let tmp_subset = []
    let tmp_sliced = []
    
    try {
        for (var n = 0; n < names.length; ++n) {
            let survivors = utils.createInt32WasmArray(ordered_intersection.length);
            survivors.fill(-1);
            let sarray = survivors.array();
            names[n].forEach((x, i) => {
                let candidate = remapping.get(x);
                if (candidate !== undefined) {
                    if (sarray[candidate] < 0) { // only consider the first occurrence.
                        sarray[candidate] = i;
                    }
                }
            });

            tmp_subset.push(survivors);
            tmp_sliced.push(subset.subsetRows(x[n], survivors));
        }

        output.matrix = cbind(tmp_sliced);
        output.indices = tmp_subset[0].slice();
        output.names = ordered_intersection;

    } catch (e) {
        utils.free(output.matrix);
        throw e;

    } finally {
        for (const x of tmp_subset) {
            utils.free(x);
        }
        for (const x of tmp_sliced) {
            utils.free(x);
        }
    }

    return output;
}
