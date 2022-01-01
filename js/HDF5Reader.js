//import * as hdf5 from './jsfive/index.js';
//import "./WasmBuffer.js";

function cloneIntoWasmBuffer(wasm, arr) {
    var output = new WasmBuffer(wasm, arr.length, "Float64Array");
    try {
        output.set(arr);
    } catch (e) {
        output.free();
        throw e;
    }

    return output;
}

function readMatrix(wasm, buffer, path) {
    var f = new hdf5.File(buffer, "HDF5");
    let entity = f.get(path);

    var output;
    if (entity instanceof hdf5.Dataset) {
        // i.e., we're dealing with a dense dataset.
        var dims = d.shape;
        var vals = cloneIntoWasmBuffer(wasm, d.value);
        try {
            output = wasm.initialize_sparse_matrix_from_dense_vector(d.shape[1], d.shape[0], vals.ptr, vals.type);
        } finally {
            vals.free();
        }
    } else if (entity instanceof hdf5.Group) {
        var shape_dex = entity.keys.indexOf("shape");
        var dims;
        var csc;

        if (shape_dex != -1) {
            // we're dealing with a 10X-formatted sparse matrix.
            dims = entity.values[shape_dex].value;
            csc = true;

        } else {
            // we're dealing with some H5AD-style sparse matrices.
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
            return cloneIntoWasmBuffer(wasm, entity.values[dex].value);
        };

        var sparse_data = null;
        var sparse_indices = null;
        var sparse_indptr = null;
        try {
            var sparse_data = loader("data");
            var sparse_indices = loader("indices");
            var sparse_indptr = loader("indptr");

            var nonzeros = sparse_data.size;
            if (sparse_indices.size !== nonzeros) {
                throw "'data' and 'indices' arrays should be of the same length";
            }

            if (csc) {
                if (dims[1] + 1 != sparse_indptr.size) {
                    throw "length of 'indptr' array should be equal to the number of columns plus 1";
                }
            } else {
                if (dims[0] + 1 != sparse_indptr.size) {
                    throw "length of 'indptr' array should be equal to the number of rows plus 1";
                }
            }

            output = wasm.initialize_sparse_matrix(
                dims[0], dims[1], nonzeros,
                sparse_data.ptr, sparse_data.type, 
                sparse_indices.ptr, sparse_indices.type,
                sparse_indptr.ptr, sparse_indptr.type,
                csc);

        } finally {
            if (sparse_data !== null) {
                sparse_data.free();
            }
            if (sparse_indices !== null) {
                sparse_indices.free();
            }
            if (sparse_indptr !== null) {
                sparse_indptr.free();
            }
        }
    }

    return output;
}
