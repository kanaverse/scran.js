import Module from "./Module.js";
import { LayeredSparseMatrix } from "./SparseMatrix.js";
import { Int8WasmArray, Int16WasmArray, Int32WasmArray, Uint8WasmArray, Uint16WasmArray, Uint32WasmArray, Float64WasmArray } from "./WasmArray.js";
import { initializeSparseMatrixFromCompressedVectors } from "./initializeSparseMatrix.js";
import * as hdf5 from "jsfive";

// Given a random array of Javascript numbers, let's try to cast it to some
// meaningful type on the Wasm heap so that we can initialize the sparse matrix.
function cloneIntoWasmArray(x) {
    var is_float = false;
    var min_val = Infinity;
    var max_val = -Infinity;

    for (var i = 0; i < x.length; i++) {
        if (!Number.isInteger(x[i])) {
            is_float = true;
            break;
        }
        if (min_val > x[i]) {
            min_val = x[i];
        }
        if (max_val < x[i]) {
            max_val = x[i];
        }
    }

    // Choosing an appropriate type.
    var output;
    if (is_float) {
        output = new Float64WasmArray(x.length);
    } else if (min_val < 0) {
        if (min_val >= -(2**7) && max_val < 2**7) {
            output = new Int8WasmArray(x.length);
        } else if (min_val >= -(2**15) && max_val < 2**15) {
            output = new Int16WasmArray(x.length);
        } else if (min_val >= -(2**31) && max_val < 2**31) {
            output = new Int32WasmArray(x.length);
        } else {
            output = new Float64WasmArray(x.length); // no HEAP64.
        }
    } else {
        if (max_val < 2**8) {
            output = new Uint8WasmArray(x.length);
        } else if (max_val < 2**16) {
            output = new Uint16WasmArray(x.length);
        } else if (max_val < 2**32) {
            output = new Uint32WasmArray(x.length);
        } else {
            output = new Float64WasmArray(x.length); // no HEAPU64.
        }
    }

    try {
        output.set(x);
    } catch (e) {
        output.free();
        throw e;
    }

    return output;
}

/**
 * Initialize a layered sparse matrix from a HDF5 file.
 *
 * @param {ArrayBuffer} buffer Buffer containing the contents of a HDF5 file.
 * @param {string} path Path to the dataset inside the file.
 * This can be a HDF5 Dataset for dense matrices or a HDF5 Group for sparse matrices.
 * For the latter, both H5AD and 10X-style sparse formats are supported.
 *
 * @return A `LayeredSparseMatrix` containing the layered sparse matrix.
 */
export function initializeSparseMatrixFromHDF5Buffer(buffer, path) {
    var output;
    let f = new hdf5.File(buffer, "temp.h5");

    let entity = f.get(path);
    if (entity instanceof hdf5.Dataset) {
        let dims = entity.shape;

        var vals = cloneIntoWasmArray(entity.value);
        var raw;
        try {
            raw = Module.initialize_sparse_matrix_from_dense_vector(
                dims[1], 
                dims[0], 
                vals.ptr, 
                vals.constructor.name.replace(/Wasm/, "")
            );
        } catch (e) {
            throw Module.get_error_message(e);
        } finally {
            vals.free();
        }

        output = new LayeredSparseMatrix(raw); 

    } else if (entity instanceof hdf5.Group) {
        var shape_dex = entity.keys.indexOf("shape");
        var dims;
        var csc;

        if (shape_dex != -1) {
            // i.e., a 10X-formatted sparse matrix.
            dims = entity.values[shape_dex].value;
            csc = true;

        } else {
            // i.e., H5AD-style sparse matrices.
            dims = entity.attrs["shape"].slice();
            dims.reverse();

            // H5AD defines columns as genes, whereas we define columns as cells.
            // So if something is listed as CSC by H5AD, it's actually CSR from our perspective.
            csc = !(entity.attrs["encoding-type"] === "csc_matrix"); 
        }

        if (dims.length != 2) {
            throw "dimensions for '" + path + "' should be an array of length 2";
        }

        var loader = function(name) {
            var dex = entity.keys.indexOf(name);
            if (dex == -1 || ! (entity.values[dex] instanceof hdf5.Dataset)) {
                throw "missing '" + name + "' dataset inside the '" + path + "' group";
            }
            return cloneIntoWasmArray(entity.values[dex].value);
        };

        var sparse_data = null;
        var sparse_indices = null;
        var sparse_indptrs = null;
        try {
            sparse_data = loader("data");
            sparse_indices = loader("indices");
            sparse_indptrs = loader("indptr");
            try {
                output = initializeSparseMatrixFromCompressedVectors(dims[0], dims[1], sparse_data, sparse_indices, sparse_indptrs, csc);
            } catch (e) {
                throw Module.get_error_message(e);
            }
        } finally {
            if (sparse_data !== null) {
                sparse_data.free();
            }
            if (sparse_indices !== null) {
                sparse_indices.free();
            }
            if (sparse_indptrs !== null) {
                sparse_indptrs.free();
            }
        }
    }

    return output;
}
