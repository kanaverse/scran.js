import * as utils from "./utils.js";
import * as wasm from "./wasm.js";

/**
 * Slice rows of a ScranMatrix
 * 
 * @param mat ScranMatrix to extract from
 * @param {Array} indices - Row indices to extract
 * all indices must be a non-negative integer less than `numberOfRows()`
 *
 * @return
 * A new ScranMatrix
 */
export function subsetRows(mat, indices) {
    let raw;
    let output;
    let wasm_indices;

    try {

        if (Math.max(...indices) > mat.numberOfRows()) {
            throw new Error("all indices to slice must be less than the number of rows.");
        }

        wasm_indices = utils.wasmifyArray(indices, "Int32WasmArray");
        raw = wasm.call(module => module.row_subset(mat.matrix, wasm_indices.offset, indices.length));
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
 * Slice columns of a ScranMatrix
 * 
 * @param mat ScranMatrix to extract from
 * @param {Array} indices - Column indices to extract
 * all indices must be a non-negative integer less than `numberOfColumns()`.
 *
 * @return
 * A new ScranMatrix
 */
export function subsetColumns(mat, indices) {
    let raw;
    let output;
    let wasm_indices;

    try {

        if (Math.max(...indices) > mat.numberOfColumns()) {
            throw new Error("all indices to slice must be less than the number of columns.");
        }

        wasm_indices = utils.wasmifyArray(indices, "Int32WasmArray");
        raw = wasm.call(module => module.column_subset(mat.matrix, wasm_indices.offset, indices.length));
        output = new mat.constructor(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    } finally {
        utils.free(wasm_indices);
    }

    return output;
}
