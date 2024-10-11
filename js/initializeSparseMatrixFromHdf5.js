import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import { ScranMatrix } from "./ScranMatrix.js";

/**
 * Initialize a (potentially layered) sparse matrix from a HDF5 file,
 * either as a 2-dimensional dataset ({@linkcode initializeSparseMatrixFromHdf5Dataset})
 * or as a group containing compressed sparse vectors ({@linkcode initializeSparseMatrixFromHdf5Group}).
 *
 * @param {string} file Path to the HDF5 file.
 * For browsers, the file should have been saved to the virtual filesystem.
 * @param {string} name Name of the matrix inside the file.
 * This can be a HDF5 Dataset for dense matrices or a HDF5 Group for sparse matrices.
 * For the latter, we expect the `data`, `indices` and `indptr` datasets, corresponding to the compressed sparse components.
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
        return initializeSparseMatrixFromHdf5Dataset(file, name, { forceInteger, layered, subsetRow, subsetColumn });
    } else {
        return initializeSparseMatrixFromHdf5Group(file, name, details.rows, details.columns, (details.format == "csr"), { forceInteger, layered, subsetRow, subsetColumn });
    }
}

function processSubsets(subsetRow, subsetColumn, FUN) {
    let output;
    let wasm_row;
    let wasm_column;

    try {
        let row_offset = 0;
        let row_length = 0;
        const use_row_subset = subsetRow !== null;
        if (use_row_subset) {
            wasm_row = utils.wasmifyArray(subsetRow, "Int32WasmArray");
            row_offset = wasm_row.offset;
            row_length = wasm_row.length;
        }

        let col_offset = 0;
        let col_length = 0;
        const use_col_subset = subsetColumn !== null;
        if (use_col_subset) {
            wasm_column = utils.wasmifyArray(subsetColumn, "Int32WasmArray");
            col_offset = wasm_column.offset;
            col_length = wasm_column.length;
        }

        output = gc.call(
            module => FUN(
                module, 
                use_row_subset, 
                row_offset, 
                row_length, 
                use_col_subset, 
                col_offset, 
                col_length
            ), 
            ScranMatrix
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(wasm_row);
        utils.free(wasm_column);
    }

    return output;
}

/**
 * Initialize a (potentially layered) sparse matrix from a 2-dimensional dataset in a HDF5 file.
 *
 * @param {string} file Path to the HDF5 file.
 * For browsers, the file should have been saved to the virtual filesystem.
 * @param {string} name Name of the 2-dimensional Dataset containing the matrix. 
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.transposed=true] - Whether the matrix is stored in a transposed format (i.e., HDF5 rows correspond to columns of the matrix).
 * Transposition is commonly used to preserve the memory layout when storing matrices from column-major frameworks like R or Fortran.
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
export function initializeSparseMatrixFromHdf5Dataset(file, name, { transposed = true, forceInteger = true, layered = true, subsetRow = null, subsetColumn = null } = {}) {
    return processSubsets(
        subsetRow,
        subsetColumn, 
        (module, use_row_subset, row_offset, row_length, use_col_subset, col_offset, col_length) => {
            return module.initialize_from_hdf5_dense(
                file, 
                name, 
                transposed,
                forceInteger,
                layered,
                use_row_subset,
                row_offset,
                row_length,
                use_col_subset,
                col_offset,
                col_length
            );
        }
    );
}

/**
 * Initialize a (potentially layered) sparse matrix from a group in a HDF5 file.
 *
 * @param {string} file Path to the HDF5 file.
 * For browsers, the file should have been saved to the virtual filesystem.
 * @param {string} name Name of the HDF5 group containing the matrix.
 * For the latter, we expect the `data`, `indices` and `indptr` datasets, corresponding to the compressed sparse components.
 * @param {number} numberOfRows - Number of rows in the sparse matrix.
 * @param {number} numberOfColumns - Number of columns in the sparse matrix.
 * @param {boolean} byRow - Whether the matrix is in the compressed sparse row format.
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
export function initializeSparseMatrixFromHdf5Group(file, name, numberOfRows, numberOfColumns, byRow, { forceInteger = true, layered = true, subsetRow = null, subsetColumn = null } = {}) {
    return processSubsets(
        subsetRow,
        subsetColumn, 
        (module, use_row_subset, row_offset, row_length, use_col_subset, col_offset, col_length) => {
            return module.initialize_from_hdf5_sparse(
                file,
                name,
                numberOfRows,
                numberOfColumns,
                !byRow,
                forceInteger,
                layered, 
                use_row_subset,
                row_offset,
                row_length,
                use_col_subset,
                col_offset,
                col_length
            );
        }
    );
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
