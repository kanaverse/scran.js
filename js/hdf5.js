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

class H5Base {
    #file;
    #name;

    constructor(file, name) {
        this.#file = file;
        this.#name = name;
    }

    get file() {
        return this.#file;
    }

    get name() {
        return this.#name;
    }
}

class H5Group extends H5Base {
    #children;

    constructor(file, name) {
        super(file, name);

        let x = wasm.call(module => new module.H5GroupDetails(file, name));
        try {
            let child_names = unpack_strings(x.buffer(), x.lengths());
            let child_types = x.types();
            let type_options = [ "Group", "DataSet", "Other" ];

            this.#children = {};
            for (var i = 0; i < child_names.length; i++) {
                this.#children[child_names[i]] = type_options[child_types[i]];
            }
        } finally {
            x.delete();
        }
    }

    get children() {
        return this.#children;
    }

    open(child) {
        let new_name = this.name;
        if (new_name != "/") {
            new_name += "/";
        } 
        new_name += child;

        if (this.#children[child] == "Group") {
            return new H5Group(this.file, new_name);
        } else if (this.#children[child] == "DataSet") {
            return new H5DataSet(this.file, new_name);
        } else {
            throw "don't know how to open '" + child + "'";
        }
    }
}

class H5File extends H5Group {
    constructor(file) {
        super(file, "/");        
    }
}

class H5DataSet extends H5Base {
    #shape;
    #type;
    #values;
    #loaded;

    static #load(file, name) {
        let vals;
        let type;
        let shape;

        let x = wasm.call(module => new module.LoadedH5DataSet(file, name));
        try {
            type = x.type();
            if (type == "other") {
                throw "cannot load dataset for an unsupported type";
            }

            if (type == "string") {
                vals = unpack_strings(x.values(), x.lengths());
            } else {
                vals = x.values().slice();
            }
            
            shape = Array.from(x.shape());
        } finally {
            x.delete();
        }

        return { "values": vals, "type": type, "shape": shape };
    }

    constructor(file, name, load = false) {
        super(file, name);

        if (!load) {
            let x = wasm.call(module => new module.H5DataSetDetails(file, name));
            try {
                this.#type = x.type();
                this.#shape = Array.from(x.shape());
                this.#values = null;
            } finally {
                x.delete();
            }
        } else {
            let deets = H5DataSet.#load(file, name);
            this.#type = deets.type;
            this.#shape = deets.shape;
            this.#values = deets.values;
        }

        this.#loaded = load;
    }

    get type() {
        return this.#type;
    }

    get shape() {
        return this.#shape;
    }

    get loaded() {
        return this.#loaded;
    }

    get values() {
        return this.#values;
    }

    load() {
        if (!this.#loaded) {
            let deets = H5DataSet.#load(file, name);
            this.#values = deets.values;
            this.#loaded = true;
        }
        return this.#values;
    }
}

function extract_names(host, output, recursive = true) {
    for (const [key, val] of Object.entries(host.children)) {
        if (val == "Group") {
            output[key] = {};
            if (recursive) {
                extract_names(host.open(key), output[key], recursive);
            }
        } else {
            let data = host.open(key);
            output[key] = data.type + " dataset";
        }
    }
}

/**
 * Extract object names from a HDF5 file.
 *
 * @param {string} path - Path to a HDF5 file.
 * For web applications, this should be saved to the virtual filesystem with `writeFile()`.
 * @param {Object} [options] - Optional parameters.
 * @param {string} [options.group] - Group to use as the root of the search.
 * If an empty string is supplied, the file is used as the group.
 * @param {boolean} [options.recursive] - Whether to recursively extract names inside child groups.
 * 
 * @return Nested object where the keys are the names of the HDF5 objects and values are their types.
 * HDF5 groups are represented by nested Javascript objects in the values;
 * these nested objects are empty if `recursive = false`.
 * HDF5 datasets are represented by strings specifying the data type - i.e., integer, float, string or other.
 */
export function extractHDF5ObjectNames (path, { group = "", recursive = true } = {}) {
    var src;
    if (group == "") {
        src = new H5File(path);
    } else {
        src = new H5Group(path, group);
    }
    var output = {};
    extract_names(src, output, recursive);
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
    var x = new H5DataSet(path, name, true);
    return {
        "dimensions": x.shape,
        "contents": x.values
    };
}
