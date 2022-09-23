import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import { ScranMatrix } from "./ScranMatrix.js";

/**
 * Initialize a sparse matrix from its compressed components.
 *
 * @param {number} numberOfRows Number of rows in the matrix.
 * @param {number} numberOfColumns Number of columns in the matrix.
 * @param {WasmArray|Array|TypedArray} values Values of all elements in the matrix, stored in column-major order.
 * These should all be non-negative integers, even if they are stored in floating-point.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, which reorders the rows of the loaded matrix for better memory efficiency.
 *
 * @return {object} An object containing:
 * - `matrix`, a {@linkplain ScranMatrix} containing the sparse matrix data.
 *   If `layered = true`, rows are shuffled to enable use of smaller integer types for low-abundance genes.
 * - `row_ids`, an Int32Array specifying the identity of each row in `matrix`.
 *   This can be interpreted as the row slicing that was applied to the original matrix to obtain `matrix`.
 *   If `layered = false`, this is `null`.
 */
export function initializeSparseMatrixFromDenseArray(numberOfRows, numberOfColumns, values, { layered = true } = {}) {
    var val_data; 
    var output;
    var ids = null; 

    try {
        val_data = utils.wasmifyArray(values, null);
        if (val_data.length !== numberOfRows * numberOfColumns) {
            throw new Error("length of 'values' is not consistent with supplied dimensions");
        }

        output = gc.call(
            module => module.initialize_sparse_matrix_from_dense_vector(
                numberOfRows, 
                numberOfColumns, 
                val_data.offset, 
                val_data.constructor.className.replace("Wasm", ""),
                layered
            ),
            ScranMatrix
        );

        if (output.isReorganized()) {
            ids = output.identities();
            output.wipeIdentities();
        }

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(val_data);
    }

    return { "matrix": output, "row_ids": ids };
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
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.byColumn=true] - Whether the supplied arrays refer to the compressed sparse column format.
 * If `true`, `indices` should contain column indices and `pointers` should specify the start of each row in `indices`.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, which reorders the rows of the loaded matrix for better memory efficiency.
 *
 * @return {object} An object containing:
 * - `matrix`, a {@linkplain ScranMatrix} containing the sparse matrix data.
 *   If `layered = true`, rows are shuffled to enable use of smaller integer types for low-abundance genes.
 * - `row_ids`, an Int32Array specifying the identity of each row in `matrix`. 
 *   This can be interpreted as the row slicing that was applied to the original matrix to obtain `matrix`.
 *   If `layered = false`, this is `null`.
 */ 
export function initializeSparseMatrixFromCompressedVectors(numberOfRows, numberOfColumns, values, indices, pointers, { byColumn = true, layered = true } = {}) {
    var val_data;
    var ind_data;
    var indp_data;
    var output;
    var ids = null;

    try {
        val_data = utils.wasmifyArray(values, null);
        ind_data = utils.wasmifyArray(indices, null);
        indp_data = utils.wasmifyArray(pointers, null);
        if (val_data.length != ind_data.length) {
            throw new Error("'values' and 'indices' should have the same length");
        }
        if (indp_data.length != (byColumn ? numberOfColumns : numberOfRows) + 1) {
            throw new Error("'pointers' does not have an appropriate length");
        }

        output = gc.call(
            module => module.initialize_sparse_matrix(
                numberOfRows, 
                numberOfColumns, 
                val_data.length, 
                val_data.offset, 
                val_data.constructor.className.replace("Wasm", ""), 
                ind_data.offset, 
                ind_data.constructor.className.replace("Wasm", ""), 
                indp_data.offset, 
                indp_data.constructor.className.replace("Wasm", ""), 
                byColumn,
                layered
            ),
            ScranMatrix
        );

        if (output.isReorganized()) {
            ids = output.identities();
            output.wipeIdentities();
        }

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(val_data);
        utils.free(ind_data);
        utils.free(indp_data);
    }

    return { "matrix": output, "row_ids": ids };
}

/** 
 * Initialize a sparse matrix from a buffer containing a MatrixMarket file.
 *
 * @param {Uint8WasmArray|Array|TypedArray|string} buffer Byte array containing the contents of a Matrix Market file with non-negative counts.
 * This can be raw text or Gzip-compressed.
 * 
 * Alternatively, this can be a string containing a file path to a MatrixMarket file.
 * On browsers, this should be a path in the virtual filesystem, typically created with {@linkcode writeFile}. 
 * @param {object} [options] - Optional parameters.
 * @param {?boolean} [options.compressed=null] - Whether the buffer is Gzip-compressed.
 * If `null`, we detect this automatically from the magic number in the header.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, which reorders the rows of the loaded matrix for better memory efficiency.
 *
 * @return {object} An object containing:
 * - `matrix`, a {@linkplain ScranMatrix} containing the sparse matrix data.
 *   If `layered = true`, rows are shuffled to enable use of smaller integer types for low-abundance genes.
 * - `row_ids`, an Int32Array specifying the identity of each row in `matrix`. 
 *   This can be interpreted as the row slicing that was applied to the original matrix to obtain `matrix`.
 *   If `layered = false`, this is `null`.
 */
export function initializeSparseMatrixFromMatrixMarket(x, { compressed = null, layered = true } = {}) {
    var buf_data;
    var output;
    var ids = null;

    try {
        compressed = convert_compressed(compressed);
        if (typeof x !== "string") {
            buf_data = utils.wasmifyArray(x, "Uint8WasmArray");
            output = gc.call(
                module => module.read_matrix_market_from_buffer(buf_data.offset, buf_data.length, compressed, layered),
                ScranMatrix
            );
        } else {
            output = gc.call(
                module => module.read_matrix_market_from_file(x, compressed, layered),
                ScranMatrix
            );
        }

        if (output.isReorganized()) {
            ids = output.identities();
            output.wipeIdentities();
        }

    } catch(e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(buf_data);
    }

    return { "matrix": output, "row_ids": ids };
}

function convert_compressed(compressed) {
    if (compressed === null) {
        return -1;
    } else if (compressed) {
        return 1;
    } else {
        return 0;
    }
}

// For back-compatibility, deprecated as of 0.3.0.
export function initializeSparseMatrixFromMatrixMarketBuffer(x, { compressed = null } = {}) {
    return initializeSparseMatrixFromMatrixMarket(x, { compressed: compressed });
}

/** 
 * Extract dimensions and other details from a MatrixMarket file.
 *
 * @param {Uint8WasmArray|Array|TypedArray|string} buffer Byte array containing the contents of a Matrix Market file with non-negative counts.
 * This can be raw text or Gzip-compressed.
 * 
 * Alternatively, this can be a string containing a file path to a MatrixMarket file.
 * On browsers, this should be a path in the virtual filesystem, typically created with {@linkcode writeFile}. 
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.compressed=null] - Whether the buffer is Gzip-compressed.
 * If `null`, we detect this automatically from the magic number in the header.
 *
 * @return {object} An object containing the number of `rows`, `columns` and `lines` in the matrix.
 */
export function extractMatrixMarketDimensions(x, { compressed = null } = {}) {
    var buf_data;
    var stats = utils.createFloat64WasmArray(3);
    let output = {};

    try {
        compressed = convert_compressed(compressed);
        if (typeof x !== "string") {
            buf_data = utils.wasmifyArray(x, "Uint8WasmArray");
            wasm.call(module => module.read_matrix_market_header_from_buffer(buf_data.offset, buf_data.length, compressed, stats.offset));
        } else {
            wasm.call(module => module.read_matrix_market_header_from_file(x, compressed, stats.offset));
        }

        let sarr = stats.array();
        output.rows = sarr[0];
        output.columns = sarr[1];
        output.lines = sarr[2];

    } finally {
        utils.free(buf_data);
        utils.free(stats);
    }

    return output;
}

/**
 * Initialize a layered sparse matrix from a HDF5 file.
 *
 * @param {string} file Path to the HDF5 file.
 * For browsers, the file should have been saved to the virtual filesystem.
 * @param {string} name Name of the dataset inside the file.
 * This can be a HDF5 Dataset for dense matrices or a HDF5 Group for sparse matrices.
 * For the latter, both H5AD and 10X-style sparse formats are supported.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, which reorders the rows of the loaded matrix for better memory efficiency.
 *
 * @return {object} An object containing:
 * - `matrix`, a {@linkplain ScranMatrix} containing the sparse matrix data.
 *   If `layered = true`, rows are shuffled to enable use of smaller integer types for low-abundance genes.
 * - `row_ids`, an Int32Array specifying the identity of each row in `matrix`. 
 *   This can be interpreted as the row slicing that was applied to the original matrix to obtain `matrix`.
 *   If `layered = false`, this is `null`.
 */
export function initializeSparseMatrixFromHDF5(file, name, { layered = true } = {}) {
    var ids = null;
    var output;

    try {
        output = gc.call(
            module => module.read_hdf5_matrix(file, name, layered),
            ScranMatrix
        );

        if (output.isReorganized()) {
            ids = output.identities();
            output.wipeIdentities();
        }

    } catch(e) {
        utils.free(output);
        throw e;
    }

    return { "matrix": output, "row_ids": ids };
}

/**
 * Initialize a dense matrix from a column-major array.
 *
 * @param {number} numberOfRows - Number of rows.
 * @param {number} numberOfColumns - Number of columns.
 * @param {(WasmArray|TypedArray|Array)} values - Array of length equal to the product of `numberOfRows` and `numberOfColumns`,
 * containing the values to store in the array.
 *
 * @return {ScranMatrix} A dense matrix, filled by column with the contents of `values`.
 */
export function initializeDenseMatrixFromDenseArray(numberOfRows, numberOfColumns, values) {
    var tmp;
    var output;

    try {
        tmp = utils.wasmifyArray(values, null);
        output = gc.call(
            module => module.initialize_dense_matrix(
                numberOfRows, 
                numberOfColumns, 
                tmp.offset, 
                tmp.constructor.className.replace("Wasm", "")
            ),
            ScranMatrix
        );
    } catch (e) {
        utils.free(output);
        throw e;
    } finally {
        utils.free(tmp);
    }

    return output;
}

/**
 * Initialize a layered sparse matrix from an RDS file.
 *
 * @param {RdsObject} x - Handle to an object inside an RDS file.
 * This should be an integer/numeric matrix, `dgCMatrix` or `dgTMatrix` object.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.consume=false] - Whether to consume the values in `x` when creating the output sparse matrix.
 * Setting this to `true` improves memory efficiency at the cost of preventing any further use of `x`.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, which reorders the rows of the loaded matrix for better memory efficiency.
 *
 * @return {object} An object containing:
 * - `matrix`, a {@linkplain ScranMatrix} containing the sparse matrix data.
 *   If `layered = true`, rows are shuffled to enable use of smaller integer types for low-abundance genes.
 * - `row_ids`, an Int32Array specifying the identity of each row in `matrix`. 
 *   This can be interpreted as the row slicing that was applied to the original matrix to obtain `matrix`.
 *   If `layered = false`, this is `null`.
 */
export function initializeSparseMatrixFromRds(x, { consume = false, layered = true } = {}) {
    var ids = null;
    var output;

    try {
        output = gc.call(
            module => module.initialize_sparse_matrix_from_rds(x.object.$$.ptr, layered, consume),
            ScranMatrix
        );

        if (output.isReorganized()) {
            ids = output.identities();
            output.wipeIdentities();
        }

    } catch(e) {
        utils.free(output);
        throw e;
    }

    return { "matrix": output, "row_ids": ids };
}
