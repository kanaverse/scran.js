import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import { ScranMatrix } from "./ScranMatrix.js";

/**
 * Initialize a dense matrix from a dense array in column-major format.
 *
 * @param {number} numberOfRows Number of rows in the matrix.
 * @param {number} numberOfColumns Number of columns in the matrix.
 * @param {WasmArray|Array|TypedArray} values Values of all elements in the matrix, stored in column-major order.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.forceInteger=false] - Whether to coerce `values` to integers via truncation.
 *
 * @return {ScranMatrix} Matrix containing dense data.
 */
export function initializeDenseMatrixFromDenseArray(numberOfRows, numberOfColumns, values, { forceInteger = false } = {}) {
    var val_data; 
    var output;

    try {
        val_data = utils.wasmifyArray(values, null);
        if (val_data.length !== numberOfRows * numberOfColumns) {
            throw new Error("length of 'values' is not consistent with supplied dimensions");
        }

        output = gc.call(
            module => module.initialize_dense_matrix_from_dense_array(
                numberOfRows, 
                numberOfColumns, 
                val_data.offset, 
                val_data.constructor.className.replace("Wasm", ""),
                forceInteger
            ),
            ScranMatrix
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(val_data);
    }

    return output;
}

/**
 * Initialize a sparse matrix from a dense array in column-major format.
 *
 * @param {number} numberOfRows Number of rows in the matrix.
 * @param {number} numberOfColumns Number of columns in the matrix.
 * @param {WasmArray|Array|TypedArray} values Values of all elements in the matrix, stored in column-major order.
 * This is generally expected to contain non-negative integers; otherwise, users should set `forceInteger = false`.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.forceInteger=true] - Whether to coerce `values` to integers via truncation.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, see [**tatami_layered**](https://github.com/tatami-inc/tatami_layered) for more details.
 * Only used if `values` contains an integer type and/or `forceInteger = true`.
 * Setting `layered = true` assumes that `values` contains only non-negative integers.
 *
 * @return {ScranMatrix} Matrix containing sparse data.
 */
export function initializeSparseMatrixFromDenseArray(numberOfRows, numberOfColumns, values, { forceInteger = true, layered = true } = {}) {
    var val_data; 
    var output;

    try {
        val_data = utils.wasmifyArray(values, null);
        if (val_data.length !== numberOfRows * numberOfColumns) {
            throw new Error("length of 'values' is not consistent with supplied dimensions");
        }

        output = gc.call(
            module => module.initialize_sparse_matrix_from_dense_array(
                numberOfRows, 
                numberOfColumns, 
                val_data.offset, 
                val_data.constructor.className.replace("Wasm", ""),
                forceInteger,
                layered
            ),
            ScranMatrix
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(val_data);
    }

    return output;
}

/**
 * Initialize a sparse matrix from the usual compressed sparse arrays.
 *
 * @param {number} numberOfRows Number of rows in the matrix.
 * @param {number} numberOfColumns Number of columns in the matrix.
 * @param {WasmArray} values Values of the non-zero elements.
 * This is generally expected to contain non-negative integers; otherwise, users should set `forceInteger = false`.
 * @param {WasmArray} indices Row indices of the non-zero elements.
 * This should be of the same length as `values`.
 * @param {WasmArray} pointers Pointers specifying the start of each column in `indices`.
 * This should have length equal to `numberOfColumns + 1`.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.byRow=true] - Whether the input arrays are supplied in the compressed sparse column format.
 * If `true`, `indices` should contain column indices and `pointers` should specify the start of each row in `indices`.
 * @param {boolean} [options.forceInteger=true] - Whether to coerce `values` to integers via truncation.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, see [**tatami_layered**](https://github.com/tatami-inc/tatami_layered) for more details.
 * Only used if `values` contains an integer type and/or `forceInteger = true`.
 * Setting to `true` assumes that `values` contains only non-negative integers.
 *
 * @return {ScranMatrix} Matrix containing sparse data.
 */ 
export function initializeSparseMatrixFromSparseArrays(numberOfRows, numberOfColumns, values, indices, pointers, { byRow = true, forceInteger = true, layered = true } = {}) {
    var val_data;
    var ind_data;
    var indp_data;
    var output;

    try {
        val_data = utils.wasmifyArray(values, null);
        ind_data = utils.wasmifyArray(indices, null);
        indp_data = utils.wasmifyArray(pointers, null);
        if (val_data.length != ind_data.length) {
            throw new Error("'values' and 'indices' should have the same length");
        }
        if (indp_data.length != (byRow ? numberOfRows : numberOfColumns) + 1) {
            throw new Error("'pointers' does not have an appropriate length");
        }

        output = gc.call(
            module => module.initialize_from_sparse_arrays(
                numberOfRows, 
                numberOfColumns, 
                val_data.length, 
                val_data.offset, 
                val_data.constructor.className.replace("Wasm", ""), 
                ind_data.offset, 
                ind_data.constructor.className.replace("Wasm", ""), 
                indp_data.offset, 
                indp_data.constructor.className.replace("Wasm", ""), 
                byRow,
                forceInteger,
                layered
            ),
            ScranMatrix
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(val_data);
        utils.free(ind_data);
        utils.free(indp_data);
    }

    return output;
}
