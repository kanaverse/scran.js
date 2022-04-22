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

function repack_strings(x) {
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
    } catch (e) {
        utils.free(buffer);
        utils.free(lengths);
        throw e;
    }

    return [lengths, buffer];
}

function check_shape(x, shape) {
    if (shape.length > 0) {
        let full_length = shape.reduce((a, b) => a * b);
        if (x.length != full_length) {
            throw new Error("length of 'x' must be equal to the product of 'shape'");
        }
    } else {
        if (x instanceof Array || ArrayBuffer.isView(x)) {
            if (x.length != 1) {
                throw new Error("length of 'x' should be 1 for a scalar dataset");
            }
        } else {
            x = [x];
        }
    }
    return x;
}


/**
 * Base class for HDF5 objects.
 */
export class H5Base {
    #file;
    #name;

    /**
     * @param {string} file - Path to the HDF5 file.
     * @param {string} name - Name of the object inside the file.
     */
    constructor(file, name) {
        this.#file = file;
        this.#name = name;
    }

    /**
     * @member {string}
     * @desc Path to the HDF5 file.
     */
    get file() {
        return this.#file;
    }

    /**
     * @member {string}
     * @desc Name of the object inside the file.
     */
    get name() {
        return this.#name;
    }
}

/**
 * Representation of a group inside a HDF5 file.
 *
 * @augments H5Base
 */
export class H5Group extends H5Base {
    #children;

    /**
     * @param {string} file - Path to the HDF5 file.
     * @param {string} name - Name of the object inside the file.
     * @param {object} [options] - Optional parameters.
     * @param {object} [options.children] - For internal use, to set the immediate children of this group.
     * If `null`, this is determined by reading the `file` at `name`.
     */
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

    /**
     * @member {object}
     * @desc An object where the keys are the names of the immediate children and the values are strings specifying the object type of each child.
     * This can be `Group`, `DataSet` or `Other`.
     */
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

    /**
     * @param {string} name - Name of the child element to open.
     * @param {object} [options] - Further options to pass to the {@linkplain H5Group} or {@linkplain H5DataSet} constructors.
     *
     * @return A {@linkplain H5Group} or {@linkplain H5DataSet} object representing the child element.
     */
    open(name, options = {}) {
        let new_name = this.#child_name(name);
        if (name in this.#children) {
            if (this.#children[name] == "Group") {
                return new H5Group(this.file, new_name, options);
            } else if (this.#children[name] == "DataSet") {
                return new H5DataSet(this.file, new_name, options); 
            } else {
                throw new Error("don't know how to open '" + name + "'");
            }
        } else {
            throw new Error("no '" + name + "' child in this HDF5 Group");
        }
    }

    /**
     * @param {string} name - Name of the group to create.
     *
     * @return A group is created as an immediate child of the current group.
     * A {@linkplain H5Group} object is returned representing this new group.
     */
    createGroup(name) {
        let new_name = this.#child_name(name);
        wasm.call(module => module.create_hdf5_group(this.file, new_name));
        this.children[name] = "Group";
        return new H5Group(this.file, new_name, { children: {} });
    }

    /**
     * @param {string} name - Name of the dataset to create.
     * @param {string} type - Type of dataset to create.
     * This can be `"IntX"` or `"UintX"` for `X` of 8, 16, 32, or 64;
     * or `"FloatX"` for `X` of 32 or 64;
     * or `"String"`.
     * @param {Array} shape - Array containing the dimensions of the dataset to create.
     * This can be set to an empty array to create a scalar dataset.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.maxStringLength} - Maximum length of the strings to be saved.
     * Only used when `type = "String"`.
     * @param {number} [options.compression] - Deflate compression level.
     * @param {Array} [options.chunks] - Array containing the chunk dimensions.
     * This should have length equal to `shape`, with each value being no greater than the corresponding value of `shape`.
     * If `null`, it defaults to `shape`.
     *
     * @return A dataset of the specified type and shape is created as an immediate child of the current group.
     * A {@linkplain H5DataSet} object is returned representing this new dataset.
     */
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
                    throw new Error("'chunks' and 'shape' should have the same dimensions");
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

    /**
     * This convenience method combines {@linkcode H5Group#createDataSet createDataSet} with {@linkcode H5DataSet#write write}.
     * It is particularly useful for string types as it avoids having to specify the `maxStringLength` during creation based on the `x` used during writing.
     * 
     * @param {string} name - Name of the dataset to create.
     * @param {Array} shape - Array containing the dimensions of the dataset to create.
     * If set to an empty array, this will create a scalar dataset.
     * If set to `null`, this is determined from `x`.
     * @param {(TypedArray|Array|string|number)} x - Values to be written to the new dataset, see {@linkcode H5DataSet#write write}.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.compression] - Deflate compression level.
     * @param {Array} [options.chunks] - Array containing the chunk dimensions.
     * This should have length equal to `shape`, with each value being no greater than the corresponding value of `shape`.
     * If `null`, it defaults to `shape`.
     *
     * @return A dataset of the specified type and shape is created as an immediate child of the current group.
     * Then it is and filled with the contents of `x`.
     * A {@linkplain H5DataSet} object is returned representing this new dataset.
     */
     writeDataSet(name, type, shape, x, { compression = 6, chunks = null } = {}) {
        if (shape === null) {
            if (typeof x == "string" || typeof x == "number") {
                x = [x];
                shape = []; // scalar, I guess.
            } else {
                shape = [x.length];
            }
        } else {
            x = check_shape(x, shape);
        }

        let handle;
        if (type == "String") {
            let [ lengths, buffer ] = repack_strings(x);
            try {
                let maxlen = 0;
                lengths.array().forEach(y => {
                    if (maxlen < y) {
                        maxlen = y;
                    }
                });

                handle = this.createDataSet(name, "String", shape, { maxStringLength: maxlen, compression: compression, chunks: chunks });
                wasm.call(module => module.write_string_hdf5_dataset(handle.file, handle.name, lengths.length, lengths.offset, buffer.offset));

            } finally {
                utils.free(lengths);
                utils.free(buffer);
            }
        } else {
            handle = this.createDataSet(name, type, shape, { compression: compression, chunks: chunks });
            handle.write(x);
        }

        return handle;
    }
}

/**
 * Representation of a HDF5 file as a top-level group.
 *
 * @augments H5Group
 */
export class H5File extends H5Group {
    /**
     * @param {string} file - Path to the HDF5 file.
     * @param {object} [options] - Optional parameters.
     * @param {object} [options.children] - For internal use, to set the immediate children of the file.
     * If `null`, this is determined by reading the `file`.
     */
    constructor(file, { children = null } = {}) {
        super(file, "/", { children: children });
    }
}

/**
 * Create a new HDF5 file.
 *
 * @param {string} path - Path to the file.
 *
 * @return A new file is created at `path`.
 * A {@linkplain H5File} object is returned.
 */
export function createNewHDF5File(path) {
    wasm.call(module => module.create_hdf5_file(path));
    return new H5File(path, { children: {} });
}

/**
 * Representation of a dataset inside a HDF5 file.
 *
 * @augments H5Base
 */
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
                throw new Error("cannot load dataset for an unsupported type");
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

    /**
     * @param {string} file - Path to the HDF5 file.
     * @param {string} name - Name of the object inside the file.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.load] - Whether or not to load the contents of the dataset in the constructor.
     * If `false`, the contents can be loaded later with {@linkcode H5DataSet#load load}.
     * @param {Array} [options.shape] - For internal use, to set the dimensions of the dataset.
     * If `null`, this is determined by reading the `file` at `name`.
     * @param {Array} [options.type] - For internal use, to set the type of the dataset.
     * If `null`, this is determined by reading the `file` at `name`.
     * @param {Array} [options.shape] - For internal use, to set the values of the dataset.
     */
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

    /**
     * @member {object}
     * @desc String containing the type of the dataset.
     * This may be `"IntX"` or `"UintX"` for `X` of 8, 16, 32, or 64;
     * or `"FloatX"` for `X` of 32 or 64;
     * `"String"`, or `"Other"`.
     * 
     */
    get type() {
        return this.#type;
    }

    /**
     * @member {Array}
     * @desc Array of integers containing the dimensions of the dataset.
     * If this is empty, the dataset is a scalar.
     */
    get shape() {
        return this.#shape;
    }

    /**
     * @member {boolean}
     * @desc Whether the contents of the dataset have already been loaded.
     */
    get loaded() {
        return this.#loaded;
    }

    /**
     * @member {(Array|TypedArray)}
     * @desc The contents of this dataset.
     * This has length equal to the product of {@linkcode H5DataSet#shape shape};
     * unless this dataset is scalar, in which case it has length 1.
     */
    get values() {
        return this.#values;
    }

    /**
     * @return The contents of this dataset are loaded and cached in this {@linkplain H5DataSet} object.
     * A (Typed)Array is returned containing those contents.
     */
    load() {
        if (!this.#loaded) {
            let deets = H5DataSet.#load(this.file, this.name);
            this.#values = deets.values;
            this.#loaded = true;
        }
        return this.#values;
    }

    /**
     * @param {(Array|TypedArray|number|string)} x - Values to write to the dataset.
     * This should be of length equal to the product of {@linkcode H5DataSet#shape shape};
     * unless `shape` is empty, in which case it should either be of length 1, or a single number or string.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.cache] - Whether to cache the written values in this {@linkplain H5DataSet} object.
     *
     * @return `x` is written to the dataset on file.
     * No return value is provided.
     */
    write(x, { cache = false } = {}) {
        x = check_shape(x, this.shape);

        if (this.type == "String") {
            let [ lengths, buffer ] = repack_strings(x);
            try {
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
            let y = utils.wasmifyArray(x, null);

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

        return;
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
