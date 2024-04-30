import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import { ScranMatrix } from "./ScranMatrix.js";

/**
 * Initialize a layered sparse matrix from a HDF5 file.
 *
 * @param {string} file Path to the HDF5 file.
 * For browsers, the file should have been saved to the virtual filesystem.
 * @param {string} name Name of the dataset inside the file.
 * This can be a HDF5 Dataset for dense matrices or a HDF5 Group for sparse matrices.
 * For the latter, both H5AD and 10X-style sparse formats are supported.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.forceInteger=true] - Whether to coerce all elements to integers via truncation.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, see [**tatami_layered**](https://github.com/tatami-inc/tatami_layered) for more details.
 * Only used if the relevant HDF5 dataset contains an integer type and/or `forceInteger = true`.
 * Setting to `true` assumes that the matrix contains only non-negative integers.
 * @param {?(Array|TypedArray|Int32WasmArray)} [options.subsetRow=null] - Row indices to extract.
 * All indices must be non-negative integers less than the number of rows in the sparse matrix.
 * @param {?(Array|TypedArray|Int32WasmArray)} [options.subsetColumn=null] - Column indices to extract.
 * All indices must be non-negative integers less than the number of columns in the sparse matrix.
 *
 * @return {ScranMatrix} Matrix containing sparse data.
 */
export function initializeSparseMatrixFromHdf5(file, name, { forceInteger = true, layered = true, subsetRow = null, subsetColumn = null } = {}) {
    const details = extractHdf5MatrixDetails(file, name);
    if (details.format == "dense") {
        // Setting transposed = true as all known dense matrices store the cells in the first dimension and the genes in the last dimension.
        return initializeSparseMatrixFromHdf5DenseArray(file, name, { transposed: true, forceInteger, layered, subsetRow, subsetColumn });
    } else {
        return initializeSparseMatrixFromHdf5SparseMatrix(file, name, details.rows, details.columns, details.format == "csc", { forceInteger, layered, subsetRow, subsetColumn });
    }
}

function prepare_hdf5_matrix_subset(subsetRow, subsetColumn, fun) {
    var output;
    let wasm_row, wasm_col;

    try {
        let use_row_subset = (subsetRow !== null);
        let row_offset = 0, row_length = 0;
        if (use_row_subset) {
            wasm_row = utils.wasmifyArray(subsetRow, "Int32WasmArray");
            row_offset = wasm_row.offset;
            row_length = wasm_row.length;
        }

        let use_col_subset = (subsetColumn !== null);
        let col_offset = 0, col_length = 0;
        if (use_col_subset) {
            wasm_col = utils.wasmifyArray(subsetColumn, "Int32WasmArray");
            col_offset = wasm_col.offset;
            col_length = wasm_col.length;
        }

        output = fun(use_row_subset, row_offset, row_length, use_col_subset, col_offset, col_length);

    } finally {
        utils.free(wasm_row);
        utils.free(wasm_col);
    }

    return output;
}

export function initializeSparseMatrixFromHdf5DenseArray(file, name, { transposed = false, forceInteger = false, layered = true, subsetRow = null, subsetColumn = null } = {}) {
    return prepare_hdf5_matrix_subset(subsetRow, subsetColumn, (use_row_subset, row_offset, row_length, use_col_subset, col_offset, col_length) => {
        return gc.call(
            module => module.read_sparse_matrix_from_hdf5_dense_array(
                file, name, transposed, forceInteger, layered,
                use_row_subset, row_offset, row_length, use_col_subset, col_offset, col_length
            ),
            ScranMatrix
        );
    });
}

export function initializeSparseMatrixFromHdf5SparseMatrix(file, name, numberOfRows, numberOfColumns, byColumn, { forceInteger = false, layered = true, subsetRow = null, subsetColumn = null } = {}) {
    return prepare_hdf5_matrix_subset(subsetRow, subsetColumn, (use_row_subset, row_offset, row_length, use_col_subset, col_offset, col_length) => {
        return gc.call(
            module => module.read_sparse_matrix_from_hdf5_sparse_matrix(
                file, name, numberOfRows, numberOfColumns, byColumn, forceInteger, layered, 
                use_row_subset, row_offset, row_length, use_col_subset, col_offset, col_length
            ),
            ScranMatrix
        );
    });
}

/**
 * Extract the format and dimensions of a HDF5 matrix.
 *
 * @param {string} file Path to the HDF5 file.
 * For browsers, the file should have been saved to the virtual filesystem.
 * @param {string} name Name of the dataset inside the file.
 * This can be a HDF5 Dataset for dense matrices or a HDF5 Group for sparse matrices.
 * For the latter, both H5AD and 10X-style sparse formats are supported.
 *
 * @return {object} An object containing:
 * - `rows`, the number of rows in the matrix.
 * - `columns`, the number of columns.
 * - `format`, whether the matrix is dense, CSR or CSC.
 * - `integer`, whether the matrix data is stored as integers or doubles.
 */
export function extractHdf5MatrixDetails(file, name) { 
    let output = {};
    let arr = utils.createInt32WasmArray(5);
    try {
        wasm.call(module => module.extract_hdf5_matrix_details(file, name, arr.offset));

        let vals = arr.array();
        if (vals[0] > 0) {
            output.format = "dense";
        } else if (vals[1] > 0) {
            output.format = "csc";
        } else {
            output.format = "csr";
        }

        output.rows = vals[2];
        output.columns = vals[3];
        output.integer = vals[4] > 0;
    } finally {
        arr.free();
    }
    return output;
}
