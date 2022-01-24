import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import { LayeredSparseMatrix } from "./SparseMatrix.js";

/**
 * Initialize a sparse matrix from its compressed components.
 *
 * @param {number} numberOfRows Number of rows in the matrix.
 * @param {number} numberOfColumns Number of columns in the matrix.
 * @param {WasmArray|Array|TypedArray} values Values of all elements in the matrix, stored in column-major order.
 * These should all be non-negative integers, even if they are stored in floating-point.
 *
 * @return A `LayeredSparseMatrix` object containing a layered sparse matrix.
 */
export function initializeSparseMatrixFromDenseArray(numberOfRows, numberOfColumns, values) {
    var val_data; 
    var raw;
    var output;

    try {
        val_data = utils.wasmifyArray(values, null);
        if (val_data.length !== numberOfRows * numberOfColumns) {
            throw "length of 'values' is not consistent with supplied dimensions";
        }

        raw = wasm.call(module => 
            module.initialize_sparse_matrix_from_dense_vector(
                numberOfRows, 
                numberOfColumns, 
                val_data.offset, 
                val_data.constructor.className.replace("Wasm", "")
            )
        );

        output = new LayeredSparseMatrix(raw); 

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(val_data);
    }

    return output;
}

/**
 * Initialize a sparse matrix from its compressed components.
 *
 * @param {number} numberOfRows Number of rows in the matrix.
 * @param {number} numberOfColumns Number of columns in the matrix.
 * @param {WasmArray} values Values of the non-zero elements.
 * These should all be non-negative integers, even if they are stored in floating-point.
 * @param {WasmArray} indices Row indices of the non-zero elements.
 * This should be of the same length as `values`.
 * @param {WasmArray} pointers Pointers specifying the start of each column in `indices`.
 * This should have length equal to `numberOfColumns + 1`.
 * @param {Object} [options] - Optional parameters.
 * @param {boolean} [options.byColumn] - Whether the supplied arrays refer to the compressed sparse column format.
 * If `false`, `indices` should contain column indices and `pointers` should specify the start of each row in `indices`.
 *
 * @return A `LayeredSparseMatrix` object containing a layered sparse matrix.
 */ 
export function initializeSparseMatrixFromCompressedVectors(numberOfRows, numberOfColumns, values, indices, pointers, { byColumn = true } = {}) {
    var val_data;
    var ind_data;
    var indp_data;
    var raw;
    var output;

    try {
        val_data = utils.wasmifyArray(values, null);
        ind_data = utils.wasmifyArray(indices, null);
        indp_data = utils.wasmifyArray(pointers, null);
        if (val_data.length != ind_data.length) {
            throw "'values' and 'indices' should have the same length";
        }
        if (indp_data.length != (byColumn ? numberOfColumns : numberOfRows) + 1) {
            throw "'pointers' does not have an appropriate length";
        }

        raw = wasm.call(module => 
            module.initialize_sparse_matrix(
                numberOfRows, 
                numberOfColumns, 
                val_data.length, 
                val_data.offset, 
                val_data.constructor.className.replace("Wasm", ""), 
                ind_data.offset, 
                ind_data.constructor.className.replace("Wasm", ""), 
                indp_data.offset, 
                indp_data.constructor.className.replace("Wasm", ""), 
                byColumn 
            )
        );

        output = new LayeredSparseMatrix(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(val_data);
        utils.free(ind_data);
        utils.free(indp_data);
    }

    return output;
}

/** 
 * Initialize a sparse matrix from a buffer containing a MatrixMarket file.
 *
 * @param {Uint8WasmArray|Array|TypedArray} buffer Byte array containing the contents of a Matrix Market file with non-negative counts.
 * This can be raw text or Gzip-compressed.
 * @param {Object} [options] - Optional parameters.
 * @param {boolean} [options.compressed] - Whether the buffer is Gzip-compressed.
 * If `null`, we detect this automatically from the magic number in the header.
 *
 * @return A `LayeredSparseMatrix` object containing a layered sparse matrix.
 */
export function initializeSparseMatrixFromMatrixMarketBuffer(buffer, { compressed = null } = {}) {
    var buf_data;
    var raw;
    var output;

    try {
        var buf_data = utils.wasmifyArray(buffer, "Uint8WasmArray");
        if (compressed === null) {
            const arr = buf_data.array();
            compressed = (arr.length >= 3 && arr[0] == 0x1F && arr[1] == 0x8B && arr[2] == 0x08);
        }
        
        raw = wasm.call(module => module.read_matrix_market(buf_data.offset, buf_data.length, compressed)); 
        output = new LayeredSparseMatrix(raw);

    } catch(e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(buf_data);
    }

    return output;
}
