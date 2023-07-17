import * as h5 from "./hdf5.js";
import * as wasm from "./wasm.js";

/**
 * Write a sparse {@linkplain ScranMatrix} into HDF5 file, in the form of its compressed sparse components.
 * This can be considered the reverse operation of {@linkcode initializeSparseMatrixFromHDF5}.
 *
 * @param {ScranMatrix} x - An input sparse matrix.
 * @param {string} path - Path to the HDF5 file.
 * A new file will be created if no file is present.
 * @param {string} name - Name of the group inside the HDF5 file in which to save `x`.
 * @param {object} [options={}] - Optional parameters.
 * @param {?string} [options.format=null] - Format to use for saving `x`.
 * This can be one of:
 *
 * - `tenx_matrix`, a compressed sparse column layout where the dimensions are stored in the `shape` dataset.
 * - `csr_matrix`, a compressed sparse column (yes, column) layout where the dimensions are stored in the `shape` attribute of the HDF5 group.
 *   The discrepancy between the name and the layout is a consequence of the original framework operating on the transposed matrix (i.e., features in columns).
 * - `csc_matrix`, a compressed sparse row layout where the dimensions are stored in the `shape` attribute of the group.
 *   Discrepancy is for the same reason as described for `csr_matrix`.
 *
 * If `null`, the "most appropriate" layout is chosen based on the layout of the data in `x`.
 * @param {boolean} [options.forceInteger=false] - Whether to force non-integer values in `x` to be coerced to integers.
 *
 * @return `x` is written to `path` at `name`.
 */
export function writeSparseMatrixToHdf5(x, path, name, { format = null, forceInteger = false } = {}) {
    if (format == null) {
        format = "automatic";
    }
    format = wasm.call(module => module.write_sparse_matrix_to_hdf5(x.matrix, path, name, format, forceInteger));

    let handle = new h5.H5Group(path, name);
    let shape = [x.numberOfRows(), x.numberOfColumns()];

    if (format == "tenx_matrix") {
        handle.writeDataSet("shape", "Int32", null, shape);
    } else if (format == "csr_matrix") {
        handle.writeAttribute("encoding-type", "String", null, "csr_matrix");
        handle.writeAttribute("shape", "Int32", null, shape.reverse()); // yes, because H5AD transposes everything, and so must we.
    } else if (format == "csc_matrix") {
        handle.writeAttribute("encoding-type", "String", null, "csc_matrix");
        handle.writeAttribute("shape", "Int32", null, shape.reverse());
    } else {
        throw new Error("unknown format '" + format + "'");
    }

    return;
}
