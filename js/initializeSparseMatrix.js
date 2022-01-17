import Module from "./Module.js";
import * as utils from "./utils.js"; 
import { LayeredSparseMatrix } from "./SparseMatrix.js";

/**
 * Initialize a sparse matrix from its compressed components.
 *
 * @param {number} nrow Number of rows in the matrix.
 * @param {number} ncol Number of columns in the matrix.
 * @param {WasmArray|Array|TypedArray} values Values of all elements in the matrix, stored in column-major order.
 * These should all be non-negative integers, even if they are stored in floating-point.
 *
 * @return A `LayeredSparseMatrix` object containing a layered sparse matrix.
 */
export function initializeSparseMatrixFromDenseArray(nrow, ncol, values) {
    var val_data; 
    var raw;
    var output;

    try {
        val_data = utils.wasmifyArray(values);
        if (val_data.length !== nrow * ncol) {
            throw "length of 'values' is not consistent with supplied dimensions";
        }

        raw = utils.wrapModuleCall(() =>         
            Module.initialize_sparse_matrix_from_dense_vector(
                nrow, 
                ncol, 
                val_data.offset, 
                val_data.constructor.name.replace("Wasm", "")
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
 * @param {number} nrow Number of rows in the matrix.
 * @param {number} ncol Number of columns in the matrix.
 * @param {WasmArray} values Values of the non-zero elements.
 * These should all be non-negative integers, even if they are stored in floating-point.
 * @param {WasmArray} indices Row indices of the non-zero elements.
 * This should be of the same length as `values`.
 * @param {WasmArray} indptrs Pointers specifying the start of each column in `indices`.
 * This should have length equal to `ncol + 1`.
 * @param {boolean} csc Whether the supplied arrays refer to compressed sparse column format.
 * If `false`, `indices` should contain column indices and `indptrs` should specify the start of each row.
 *
 * @return A `LayeredSparseMatrix` object containing a layered sparse matrix.
 */ 
export function initializeSparseMatrixFromCompressedVectors(nrow, ncol, values, indices, indptrs, csc = true) {
    var val_data;
    var ind_data;
    var indp_data;
    var raw;
    var output;

    try {
        val_data = utils.wasmifyArray(values);
        ind_data = utils.wasmifyArray(indices);
        indp_data = utils.wasmifyArray(indptrs);
        if (val_data.length != ind_data.length) {
            throw "'values' and 'indices' should have the same length";
        }
        if (indp_data.length != (csc ? ncol : nrow) + 1) {
            throw "'indptrs' does not have an appropriate length";
        }

        raw = Module.initialize_sparse_matrix(
            nrow, 
            ncol, 
            val_data.length, 
            val_data.offset, 
            val_data.constructor.name.replace("Wasm", ""), 
            ind_data.offset, 
            ind_data.constructor.name.replace("Wasm", ""), 
            indp_data.offset, 
            indp_data.constructor.name.replace("Wasm", ""), 
            csc
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
 * @param {boolean} compressed Whether the buffer is Gzip-compressed.
 * If `null`, we detect this automatically from the magic number in the header.
 *
 * @return A `LayeredSparseMatrix` object containing a layered sparse matrix.
 */
export function initializeSparseMatrixFromMatrixMarketBuffer(buffer, compressed = null) {
    var buf_data;
    var raw;
    var output;

    try {
        var buf_data = utils.wasmifyArray(buffer, "Uint8WasmArray");
        if (compressed === null) {
            const arr = buf_data.array();
            compressed = (arr.length >= 3 && arr[0] == 0x1F && arr[1] == 0x8B && arr[2] == 0x08);
        }
        
        raw = utils.wrapModuleCall(() => Module.read_matrix_market(buf_data.offset, buf_data.length, compressed)); 
        output = new LayeredSparseMatrix(raw);

    } catch(e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(buf_data);
    }

    return output;
}
