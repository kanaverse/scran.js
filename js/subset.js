import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import { MultiMatrix } from "./MultiMatrix.js";

/**
 * Slice a {@linkplain ScranMatrix} by its rows.
 * 
 * @param {ScranMatrix} x - The matrix of interest.
 * @param {Array} indices - Row indices to extract.
 * All indices must be non-negative integers less than `mat.numberOfRows()`.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.inPlace=false] - Whether to modify `x` in place.
 * If `false`, a new ScranMatrix is returned.
 *
 * @return {ScranMatrix}
 * A ScranMatrix containing the subset of rows from `mat` specified by `indices`.
 * If `inPlace = true`, this is a reference to `x`, otherwise it is a new ScranMatrix.
 */
export function subsetRows(x, indices, { inPlace = false } = {}) {
    let xcopy;
    let target;
    let wasm_indices;

    try {
        if (inPlace) {
            target = x;
        } else {
            xcopy = x.clone();
            target = xcopy;
        }

        wasm_indices = utils.wasmifyArray(indices, "Int32WasmArray");
        wasm.call(module => module.row_subset(target.matrix, wasm_indices.offset, wasm_indices.length));

    } catch (e) {
        utils.free(xcopy);
        throw e;

    } finally {
        utils.free(wasm_indices);
    }

    return target;
}

/**
 * Slice a ScranMatrix by its columns.
 * 
 * @param {ScranMatrix} x - The matrix of interest.
 * @param {Array} indices - Column indices to extract.
 * Al indices must be a non-negative integer less than `mat.numberOfColumns()`.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.inPlace=false] - Whether to modify `x` in place.
 * If `false`, a new ScranMatrix is returned.
 *
 * @return {ScranMatrix}
 * A new ScranMatrix containing the subset of columns from `mat` specified by `indices`.
 * If `inPlace = true`, this is a reference to `x`, otherwise it is a new ScranMatrix.
 */
export function subsetColumns(x, indices, { inPlace = false } = {}) {
    let xcopy;
    let target;
    let wasm_indices;

    try {
        if (inPlace) {
            target = x;
        } else {
            xcopy = x.clone();
            target = xcopy;
        }

        wasm_indices = utils.wasmifyArray(indices, "Int32WasmArray");
        wasm.call(module => module.column_subset(target.matrix, wasm_indices.offset, wasm_indices.length));

    } catch (e) {
        utils.free(xcopy);
        throw e;

    } finally {
        utils.free(wasm_indices);
    }

    return target;
}

/**
 * Split a {@linkplain ScranMatrix} by row.
 *
 * @param {ScranMatrix} matrix - A ScranMatrix object.
 * @param {object} split - Object specifying how rows should be split.
 * Each value should be an Array/TypedArray of 0-based row indices.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.singleNull=false] - Whether `null` should be returned if `split` only contains one level and all rows are represented exactly once.
 * This can be used to avoid the creation of a redundant {@linkplain ScranMatrix} object.
 * @param {boolean} [options.createMultiMatrix=false] - Whether the output should be returned as a {@linkplain MultiMatrix}.
 *
 * @return {object|MultiMatrix} Object with the same keys as `split` where each value is a ScranMatrix for the corresponding subset of rows.
 * Alternatively, this is wrapped in a MultiMatrix if `createMultiMatrix = true`.
 */
export function splitRows(matrix, split, { singleNull = false, createMultiMatrix = false } = {}) { 
    let output = {};
    let tkeys = Object.keys(split);

    if (tkeys.length == 1) {
        let chosen = split[tkeys[0]];
        let consec = (chosen.length == matrix.numberOfRows());
        if (consec) {
            for (var i = 0; i < chosen.length; i++) {
                if (i != chosen[i]) {
                    consec = false;
                    break;
                }
            }
        }

        if (consec) {
            if (singleNull) {
                return null;
            } else {
                output[tkeys[0]] = matrix.clone();
                return output;
            }
        }
    }

    let stuff;
    try {
        for (const k of tkeys) {
            output[k] = subsetRows(matrix, split[k]);
        }

        // Sticking this inside the trycatch, so that
        // memory is released if the constructor fails. 
        if (createMultiMatrix) {
            stuff = new MultiMatrix({ store: output });
        }
    } catch (e) {
        for (const v of Object.values(output)) {
            v.free();
        }
        throw e;
    }

    if (createMultiMatrix) {
        return stuff;
    } else {
        return output;
    }
}
