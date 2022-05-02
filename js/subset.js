import * as utils from "./utils.js";
import * as wasm from "./wasm.js";

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




