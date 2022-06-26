import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import { MultiMatrix } from "./MultiMatrix.js";

/**
 * Slice a {@linkplain ScranMatrix} by its rows.
 * 
 * @param {ScranMatrix} The matrix of interest.
 * @param {Array} indices - Row indices to extract.
 * All indices must be non-negative integers less than `mat.numberOfRows()`.
 *
 * @return
 * A new ScranMatrix containing the subset of rows from `mat` specified by `indices`.
 */
export function subsetRows(mat, indices) {
    let raw;
    let output;
    let wasm_indices;

    try {
        wasm_indices = utils.wasmifyArray(indices, "Int32WasmArray");
        raw = wasm.call(module => module.row_subset(mat.matrix, wasm_indices.offset, wasm_indices.length));
        output = new mat.constructor(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    } finally {
        utils.free(wasm_indices);
    }

    return output;
}

/**
 * Slice a ScranMatrix by its columns.
 * 
 * @param {ScranMatrix} The matrix of interest.
 * @param {Array} indices - Column indices to extract.
 * Al indices must be a non-negative integer less than `mat.numberOfColumns()`.
 *
 * @return
 * A new ScranMatrix containing the subset of columns from `mat` specified by `indices`.
 */
export function subsetColumns(mat, indices) {
    let raw;
    let output;
    let wasm_indices;

    try {
        wasm_indices = utils.wasmifyArray(indices, "Int32WasmArray");
        raw = wasm.call(module => module.column_subset(mat.matrix, wasm_indices.offset, wasm_indices.length));
        output = new mat.constructor(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    } finally {
        utils.free(wasm_indices);
    }

    return output;
}

/**
 * Given a factor, return the indices corresponding to each level.
 * This can be used in subsequent {@linkcode splitRows} calls.
 *
 * @param {Array|TypedArray} factor - Array containing the factor of interest.
 *
 * @return {object} Object where each key is a factor level and each value is an array containing the indices corresponding to that level in `factor`.
 */
export function splitByFactor(factor) {
    let by = {};
    factor.forEach((x, i) => {
        if (!(x in by)) {
            by[x] = [];
        }
        by[x].push(i);
    });
    return by;
}

/**
 * Split a {@linkplain ScranMatrix} by row.
 *
 * @param {ScranMatrix} matrix - A ScranMatrix object.
 * @param {object} split - Object specifying how rows shouhld be split, usually produced by {@link splitByFactor}.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.singleNull] - Whether `null` should be returned if `split` only contains one level.
 * This can be used to avoid the creation of a redundant ScranMatrix object.
 * @param {boolean} [options.createMultimatrix] - Whether the output should be returned as a {@linkplain Multimatrix}.
 *
 * @return {object|MultiMatrix} Object with the same keys as `split` where each value is a ScranMatrix for the corresponding subset of rows.
 * Alternatively, this is wrapped in a `MultiMatrix` if `createMultiMatrix = true`.
 */
export function splitRows(matrix, split, { singleNull = false, createMultiMatrix = false } = {}) { 
    let output = {};
    let tkeys = Object.keys(split);
    if (tkeys.length == 1) {
        if (singleNull) {
            return null;
        } else {
            output[tkeys[0]] = matrix.clone();
            return output;
        }
    }

    try {
        for (const k of tkeys) {
            output[k] = subsetRows(matrix, split[k]);
        }
    } catch (e) {
        for (const v of Object.values(output)) {
            v.free();
        }
        throw e;
    }

    if (createMultiMatrix) {
        return new MultiMatrix({ store: output });
    } else {
        return output;
    }
}
