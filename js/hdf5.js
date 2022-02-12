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
 * @param {Object} options - Optional parameters.
 * @param {string} options.group - Group to use as the root of the search.
 * If an empty string is supplied, the file is used as the group.
 * @param {boolean} recursive - Whether to recursively extract names inside child groups.
 * 
 * @return Nested object where the keys are the names of the HDF5 objects and values are their types.
 * HDF5 groups are represented by nested Javascript objects in the values;
 * these nested objects are empty if `recursive = false`.
 * HDF5 datasets are represented by strings specifying the data type - i.e., integer, float, string or other.
 */
export function extractHDF5ObjectNames (path, { group = "", recursive = true } = {}) {
    var raw;
    var output;

    try {
        raw = wasm.call(module => module.extract_hdf5_names(path, group, recursive));
        let names = unpack_strings(raw.buffer(), raw.lengths());

        // Registering the types.
        let typ = raw.types();
        const ref = ["group", "integer dataset", "float dataset", "string dataset", "other dataset"];

        // Organizing into an object.
        let par = raw.parents();
        output = {};
        let hosts = new Array(par.length);

        names.forEach((x, i) => {
            let curhost;
            if (par[i] < 0) {
                curhost = output;
            } else {
                curhost = hosts[par[i]];
            }

            let curtype = ref[typ[i]];
            if (curtype === "group") {
                curhost[x] = {};
                hosts[i] = curhost[x];
            } else {
                curhost[x] = curtype;
            }
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

