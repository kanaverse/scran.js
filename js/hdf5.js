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

export class H5Base {
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

export class H5Group extends H5Base {
    #children;

    constructor(file, name, { children = null } = {}) {
        super(file, name);

        if (children === null) {
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
        } else {
            this.#children = children;
        }
    }

    get children() {
        return this.#children;
    }

    #child_name(child) {
        let new_name = this.name;
        if (new_name != "/") {
            new_name += "/";
        } 
        new_name += child;
        return new_name;
    }

    open(name) {
        let new_name = this.#child_name(name);
        if (name in this.#children) {
            if (this.#children[name] == "Group") {
                return new H5Group(this.file, new_name);
            } else if (this.#children[name] == "DataSet") {
                return new H5DataSet(this.file, new_name);
            } else {
                throw "don't know how to open '" + name + "'";
            }
        } else {
            throw "no '" + name + "' child in this HDF5 Group";
        }
    }

    createGroup(name) {
        let new_name = this.#child_name(name);
        wasm.call(module => module.create_hdf5_group(this.file, new_name));
        this.children[name] = "Group";
        return new H5Group(this.file, new_name, { children: {} });
    }

    createDataSet(name, type, shape, { maxStringLength = 10, compression = 6, chunks = null } = {}) {
        let new_name = this.#child_name(name);

        let shape_arr;
        let chunk_arr; 
        try {
            shape_arr = utils.wasmifyArray(shape, "Int32WasmArray");

            let chunk_offset = shape_arr.offset;
            if (chunks !== null) {
                chunk_arr = utils.wasmifyArray(chunks, "Int32WasmArray");
                if (chunk_arr.length != shape_arr.length) {
                    throw "'chunks' and 'shape' should have the same dimensions";
                }
                chunk_offset = chunk_arr.offset;
            }

            wasm.call(module => module.create_hdf5_dataset(this.file, new_name, type, shape_arr.length, shape_arr.offset, maxStringLength, compression, chunk_offset));
        } finally {
            shape_arr.free();
        }

        this.children[name] = "DataSet";
        return new H5DataSet(this.file, new_name, { type: type, shape: shape });
    }
}

export class H5File extends H5Group {
    constructor(file, { children = null } = {}) {
        super(file, "/", { children: children });
    }
}

export function createNewHDF5File(name) {
    wasm.call(module => module.create_hdf5_file(name));
    return new H5File(name, { children: {} });
}

export class H5DataSet extends H5Base {
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

            if (type == "String") {
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

    constructor(file, name, { load = false, shape = null, type = null, values = null } = {}) {
        super(file, name);

        if (shape === null && type === null) {
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
        } else {
            this.#shape = shape;
            this.#type = type;
            this.#values = values;
            this.#loaded = (values !== null);
        }
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
            let deets = H5DataSet.#load(this.file, this.name);
            this.#values = deets.values;
            this.#loaded = true;
        }
        return this.#values;
    }

    write(x, { cache = false } = {}) {
        let full_length = this.shape.reduce((a, b) => a * b);
        if (x.length != full_length) {
            throw "length of 'x' must be equal to the product of 'shape'";
        }

        if (this.type == "String") {
            let buffer;
            let lengths;

            try {
                lengths = utils.createInt32WasmArray(x.length);
                let lengths_arr = lengths.array();

                let total = 0;
                const enc = new TextEncoder;
                let contents = new Array(x.length);

                x.forEach((y, i) => {
                    let e = enc.encode(y);
                    lengths_arr[i] = e.length;
                    contents[i] = e;
                    total += e.length;
                });

                buffer = utils.createUint8WasmArray(total);
                let buffer_arr = buffer.array();
                total = 0;

                contents.forEach(y => {
                    buffer_arr.set(y, total);
                    total += y.length;
                });

                wasm.call(module => module.write_string_hdf5_dataset(this.file, this.name, lengths.length, lengths.offset, buffer.offset));

            } finally {
                utils.free(buffer);
                utils.free(lengths);
            }

            if (cache) {
                this.#values = x.slice();
                this.#loaded = true;
            } else {
                this.#loaded = false;
                this.#values = null;
            }
        } else {
            let y = utils.wasmifyArray(x, null); // take whatever the type is.
            try {
                wasm.call(module => module.write_numeric_hdf5_dataset(this.file, this.name, y.constructor.className, y.offset));
                if (cache) {
                    this.#values = y.slice();
                    this.#loaded = true;
                } else {
                    this.#loaded = false;
                    this.#values = null;
                }
            } finally {
                y.free();
            }
        }
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

            let dclass;
            if (data.type.startsWith("Uint") || data.type.startsWith("Int")) {
                dclass = "integer";
            } else if (data.type.startsWith("Float")) {
                dclass = "float";
            } else {
                dclass = data.type.toLowerCase();
            }

            output[key] = dclass + " dataset";
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
    var x = new H5DataSet(path, name, { load: true });
    return {
        "dimensions": x.shape,
        "contents": x.values
    };
}
