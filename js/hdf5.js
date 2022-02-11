import * as utils from "./utils.js";
import * as wasm from "./wasm.js";

function unpack_strings(buffer, lengths) {
    let dec = new TextDecoder();
    let names = [];
    let sofar = 0;
    for (const l of lengths) {
        let view = buffer.slice(sofar, sofar + l);
        names.push(dec.decode(view));
        sofar += l;
    }
    return names;
}

/**
 * Extract object names from a HDF5 file.
 *
 * @param {string} path - Path to a HDF5 file.
 * For web applications, this should be saved to the virtual filesystem with `writeFile()`.
 * 
 * @return Object where the keys are the names and the values are the types, i.e., group or integer/float/string/other dataset.
 */
export function extractHDF5ObjectNames (path) {
    var raw;
    var output;

    try {
        raw = wasm.call(module => module.extract_hdf5_names(path));
        let names = unpack_strings(raw.buffer(), raw.lengths());

        // Registering the types.
        let typ = raw.types();
        const ref = ["group", "integer dataset", "float dataset", "string dataset", "other dataset"];

        output = {};
        names.forEach((x, i) => {
            output[x] = ref[typ[i]];
        });

    } finally {
        utils.free(raw);
    }

    return output;
}

/**
 * Load a dataset from a HDF5 file.
 *
 * @param {string} path - Path to a HDF5 file.
 * For web applications, this should be saved to the virtual filesystem with `writeFile()`.
 * @param {string} name - Name of a dataset inside the HDF5 file.
 * 
 * @return An object containing `dimensions`, an array containing the dimensions of the dataset;
 * and `contents`, a `Int32Array`, `Float64Array` or array of strings, depending on the type of the dataset. 
 */
export function loadHDF5Dataset(path, name) {
    var raw;
    var output = {};

    try {
        raw = wasm.call(module => module.load_hdf5_dataset(path, name));
        output.dimensions = Array.from(raw.dimensions());
        if (raw.type() != 3) {
            output.contents = raw.values().slice();
        } else {
            output.contents = unpack_strings(raw.values(), raw.lengths());
        }
    } finally {
        utils.free(raw);
    }

    return output;
}

