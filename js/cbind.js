import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";
import * as gc from "./gc.js";

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
 *
 * @return {object} An object containing:
 * - `matrix`, a {@linkplain ScranMatrix} containing the combined matrices.
 * - `indices`, an Int32WasmArray of length equal to the number of rows in `matrix`.
 *    This contains the index of the row in the first entry of `inputs` corresponding to each row of `matrix`,
 *    i.e., the gene at the `i`-th row of `matrix` is the same as the gene at the `indices[i]`-th row of `inputs[0]`.
 * - `names`, an array of names identifying the rows of `matrix`.
 *    This is constructed by indexing the first entry of `names` with `indices`.
 */
export function cbindWithNames(x, names) {
    let mat_ptrs;
    let renamed = [];
    let name_ptrs;
    let indices;
    let output = {};

    try {
        // Building a common set of rownames.
        if (names.length !== x.length) {
            throw new Error("length of 'names' should be equal to length of 'x'");
        }

        let common = {};
        let universe = [];
        for (var i = 0; i < names.length; i++) {
            if (x[i].numberOfRows() !== names[i].length) {
                throw new Error("length of each 'names' must equal number of rows of its corresponding 'x'");
            }
            names[i].forEach(x => {
                if (!(x in common)) {
                    common[x] = universe.length;
                    universe.push(x);
                }
            });
        }

        name_ptrs = utils.createBigUint64WasmArray(x.length);
        {
            let names_arr = name_ptrs.array();
            for (var i = 0; i < names.length; i++) {
                let current = names[i];
                let replacement = utils.createInt32WasmArray(current.length);
                let replacement_arr = replacement.array();
                current.forEach((x, i) => {
                    replacement_arr[i] = common[x];
                });
                renamed.push(replacement);
                names_arr[i] = BigInt(replacement.offset);
            }
        }

        mat_ptrs = harvest_matrices(x);
        indices = utils.createInt32WasmArray(x[0].numberOfRows());
        output.matrix = gc.call(
            module => module.cbind_with_rownames(x.length, mat_ptrs.offset, name_ptrs.offset, indices.offset),
            ScranMatrix
        );

        output.indices = indices.slice(0, output.matrix.numberOfRows());
        let internames = [];
        for (const i of output.indices) {
            internames.push(names[0][i]);
        }
        output.names = internames;

    } catch (e) {
        utils.free(output.matrix);
        throw e;

    } finally {
        utils.free(mat_ptrs);
        utils.free(name_ptrs);
        utils.free(indices);
        for (const x of renamed) {
            utils.free(x);
        }
    }

    return output;
}
