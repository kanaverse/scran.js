import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import * as packer from "./internal/pack_strings.js";
import * as fac from "./factorize.js";

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

function guess_shape(x, shape) {
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
    return { x: x, shape: shape };
}

function forbid_strings(x) {
    if (Array.isArray(x)) {
        // no strings allowed!
        for (const x0 of x) {
            if (typeof x0 === "string") {
                throw new Error("'x' should not contain any strings for a non-string HDF5 dataset");
            }
        }
    }
}

function fetch_max_string_length(lengths) {
    let maxlen = 0;
    lengths.array().forEach(y => {
        if (maxlen < y) {
            maxlen = y;
        }
    });
    return maxlen;
}

function process_enum_input(values, levels, arg) {
    if (levels !== null) {
        for (const i of values) {
            if (!Number.isInteger(i) || i < 0 || i >= levels.length) {
                throw new Error("'" + arg + "' must contain non-negative integers less than 'levels.length' for 'type = \"Enum\"'");
            }
        }

    } else {
        let out = fac.convertToFactor(values, { asWasmArray: false });
        values = out.ids;
        levels = out.levels;
        for (const l of levels) {
            if (typeof l !== "string") {
                throw new Error("'" + arg + "' should only contain string levels for 'type = \"Enum\"'");
            }
        }
    }

    return { values: values, levels: levels }
}

/**
 * Base class for HDF5 objects.
 */
export class H5Base {
    #file;
    #name;
    #attributes;

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

    /**
     * @member {Array}
     * @desc Array containing the names of all attributes of this object.
     */
    get attributes() {
        return this.#attributes;
    }

    set_attributes(attributes) { // internal use only, for subclasses.
        this.#attributes = attributes;
    }

    /**
     * Read an attribute of the object.
     *
     * @param {string} attr - Name of the attribute.
     * @return {object} Object containing the attribute `values` and the `shape` of the attribute.
     * For HDF5 enums, an additional `level` property is present, containing the levels indexed by the integer `values`.
     */
    readAttribute(attr) {
        let output = { values: null, shape: null };

        let x = wasm.call(module => new module.LoadedH5Attr(this.file, this.name, attr));
        try {
            output.shape = Array.from(x.shape());

            let type = x.type();
            if (type == "other") {
                throw new Error("cannot load dataset for an unsupported type");
            }

            if (type == "String") {
                output.values = packer.unpack_strings(x.string_buffer(), x.string_lengths());
            } else if (type == "Enum") {
                output.values = x.numeric_values().slice();
                output.levels = packer.unpack_strings(x.string_buffer(), x.string_lengths());
            } else {
                output.values = x.numeric_values().slice();
            }
        } finally {
            x.delete();
        }

        return output;
    }

    #create_attribute(attr, type, shape, options = {}) { // internal use only.
        const { maxStringLength = null, levels = null, ...others } = options;
        utils.checkOtherOptions(others);

        let shape_arr = utils.wasmifyArray(shape, "Int32WasmArray");
        try {
            if (type == "String") {
                wasm.call(module => module.create_string_hdf5_attribute(this.file, this.name, attr, shape_arr.length, shape_arr.offset, maxStringLength));
            } else if (type == "Enum") {
                if (levels == null) {
                    throw new Error("levels must be supplied if 'type = \"Enum\"'");
                }
                let [ lengths, buffer ] = packer.repack_strings(levels);
                wasm.call(module => module.create_enum_hdf5_attribute(this.file, this.name, attr, shape_arr.length, shape_arr.offset, lengths.length, lengths.offset, buffer.offset));
            } else {
                wasm.call(module => module.create_numeric_hdf5_attribute(this.file, this.name, attr, shape_arr.length, shape_arr.offset, type));
            }
            this.#attributes.push(attr);
        } finally {
            shape_arr.free();
        }
    }

    /**
     * Write an attribute for the object.
     *
     * @param {string} attr - Name of the attribute.
     * @param {string} type - Type of dataset to create.
     * This can be `"IntX"` or `"UintX"` for `X` of 8, 16, 32, or 64;
     * or `"FloatX"` for `X` of 32 or 64;
     * or `"String"`;
     * or `"Enum"`.
     * @param {?Array} shape - Array containing the dimensions of the dataset to create.
     * If set to an empty array, this will create a scalar dataset.
     * If set to `null`, this is determined from `x`.
     * @param {(TypedArray|Array|string|number)} x - Values to be written to the new dataset, see {@linkcode H5DataSet#write write}.
     * This should be of length equal to the product of `shape`;
     * unless `shape` is empty, in which case it should either be of length 1, or a single number or string.
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.maxStringLength=null] - Maximum length of the strings to be saved.
     * Only used when `type = "String"`.
     * If `null`, this is inferred from the maximum length of strings in `x`.
     * @param {?Array} [options.levels=null] - Array of strings containing enum levels when `type = "Enum"`.
     * If supplied, `x` should be an array of integers that index into `levels`.
     * Alternatively, `levels` may be `null`, in which case `x` should be an array of strings that is used to infer `levels`.
     */
    writeAttribute(attr, type, shape, x, options = {}) {
        let { maxStringLength = null, levels = null, ...others } = options;
        utils.checkOtherOptions(others);

        if (x === null) {
            throw new Error("cannot write 'null' to HDF5"); 
        }

        let guessed = guess_shape(x, shape);
        x = guessed.x;
        shape = guessed.shape;

        if (type == "String") {
            let [ lengths, buffer ] = packer.repack_strings(x);
            try {
                if (maxStringLength == null) {
                    maxStringLength = fetch_max_string_length(lengths);
                }
                this.#create_attribute(attr, type, shape, { maxStringLength: maxStringLength });
                wasm.call(module => module.write_string_hdf5_attribute(this.file, this.name, attr, lengths.length, lengths.offset, buffer.offset));
            } finally {
                utils.free(buffer);
                utils.free(lengths);
            }

        } else if (type == "Enum") {
            let processed = process_enum_input(x, levels, "x");
            let y = utils.wasmifyArray(processed.values, "Int32WasmArray");
            try {
                this.#create_attribute(attr, type, shape, { levels: processed.levels });
                wasm.call(module => module.write_enum_hdf5_attribute(this.file, this.name, attr, y.offset));
            } finally {
                y.free();
            }

        } else {
            forbid_strings(x);
            let y = utils.wasmifyArray(x, null);
            try {
                this.#create_attribute(attr, type, shape);
                wasm.call(module => module.write_numeric_hdf5_attribute(this.file, this.name, attr, y.constructor.className, y.offset));
            } finally {
                y.free();
            }
        }

        return;
    }
}

/**
 * Representation of a group inside a HDF5 file.
 *
 * @augments H5Base
 */
export class H5Group extends H5Base {
    #children;
    #attributes;

    /**
     * @param {string} file - Path to the HDF5 file.
     * @param {string} name - Name of the group inside the file.
     * @param {object} [options={}] - Optional parameters, for internal use only.
     */
    constructor(file, name, options = {}) {
        const { newlyCreated = false, ...others } = options;
        utils.checkOtherOptions(others);
        super(file, name);

        if (newlyCreated) {
            this.#children = {};
            this.set_attributes([]);
        } else {
            let x = wasm.call(module => new module.H5GroupDetails(file, name));
            try {
                let child_names = packer.unpack_strings(x.child_buffer(), x.child_lengths());
                let child_types = x.child_types();
                let type_options = [ "Group", "DataSet", "Other" ];

                this.#children = {};
                for (var i = 0; i < child_names.length; i++) {
                    this.#children[child_names[i]] = type_options[child_types[i]];
                }

                let unpacked = packer.unpack_strings(x.attr_buffer(), x.attr_lengths());
                this.set_attributes(unpacked);
            } finally {
                x.delete();
            }
        }
    }

    /**
     * @member {object}
     * @desc An object where the keys are the names of the immediate children and the values are strings specifying the object type of each child.
     * Each string can be one of `"Group"`, `"DataSet"` or `"Other"`.
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
     * @param {object} [options={}] - Further options to pass to the {@linkplain H5Group} or {@linkplain H5DataSet} constructors.
     *
     * @return {H5Group|H5DataSet} Object representing the child element.
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
     * @return {@H5Group} A group is created as an immediate child of the current group.
     * A {@linkplain H5Group} object is returned representing this new group.
     * If a group already exists at `name`, it is returned directly.
     */
    createGroup(name) {
        let new_name = this.#child_name(name);
        if (name in this.children) {
            if (this.children[name] == "Group") {
                return new H5Group(this.file, new_name);
            } else {
                throw new Error("existing child '" + new_name + "' is not a HDF5 group");
            }
        } else {
            wasm.call(module => module.create_hdf5_group(this.file, new_name));
            this.children[name] = "Group";
            return new H5Group(this.file, new_name, { newlyCreated: true });
        }
    }

    /**
     * @param {string} name - Name of the dataset to create.
     * @param {string} type - Type of dataset to create.
     * This can be `"IntX"` or `"UintX"` for `X` of 8, 16, 32, or 64;
     * or `"FloatX"` for `X` of 32 or 64;
     * or `"String"`;
     * or `"Enum"`.
     * @param {Array} shape - Array containing the dimensions of the dataset to create.
     * This can be set to an empty array to create a scalar dataset.
     * @param {object} [options={}] - Optional parameters.
     * @param {number} [options.maxStringLength=10] - Maximum length of the strings to be saved.
     * Only used when `type = "String"`.
     * @param {number} [options.compression=6] - Deflate compression level.
     * @param {?Array} [options.chunks=null] - Array containing the chunk dimensions.
     * This should have length equal to `shape`, with each value being no greater than the corresponding value of `shape`.
     * If `null`, it defaults to `shape`.
     * @param {?Array} [options.levels=null] - Array of strings containing enum levels.
     * Only used (and mandatory) when `type = "Enum"`.
     *
     * @return {H5DataSet} A dataset of the specified type and shape is created as an immediate child of the current group.
     * A {@linkplain H5DataSet} object is returned representing this new dataset.
     */
    createDataSet(name, type, shape, options = {}) {
        const { maxStringLength = 10, levels = null, compression = 6, chunks = null, ...others } = options;
        utils.checkOtherOptions(others);

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

            if (type == "String") {
                wasm.call(module => module.create_string_hdf5_dataset(this.file, new_name, shape_arr.length, shape_arr.offset, compression, chunk_offset, maxStringLength));
            } else if (type == "Enum") {
                if (levels == null) {
                    throw new Error("levels must be supplied if 'type = \"Enum\"'");
                }
                let [ lengths, buffer ] = packer.repack_strings(levels);
                wasm.call(module => module.create_enum_hdf5_dataset(this.file, new_name, shape_arr.length, shape_arr.offset, compression, chunk_offset, lengths.length, lengths.offset, buffer.offset));
            } else {
                wasm.call(module => module.create_numeric_hdf5_dataset(this.file, new_name, shape_arr.length, shape_arr.offset, compression, chunk_offset, type));
            }

        } finally {
            shape_arr.free();
        }

        this.children[name] = "DataSet";
        return new H5DataSet(this.file, new_name, { newlyCreated: true, type: type, shape: shape });
    }

    /**
     * This convenience method combines {@linkcode H5Group#createDataSet createDataSet} with {@linkcode H5DataSet#write write}.
     * It is particularly useful for string types as it avoids having to specify the `maxStringLength` during creation based on the `x` used during writing.
     * 
     * @param {string} name - Name of the dataset to create.
     * @param {string} type - Type of dataset to create.
     * This can be `"IntX"` or `"UintX"` for `X` of 8, 16, 32, or 64;
     * or `"FloatX"` for `X` of 32 or 64;
     * or `"String"`.
     * @param {Array} shape - Array containing the dimensions of the dataset to create.
     * If set to an empty array, this will create a scalar dataset.
     * If set to `null`, this is determined from `x`.
     * @param {(TypedArray|Array|string|number)} x - Values to be written to the new dataset, see {@linkcode H5DataSet#write write}.
     * @param {object} [options={}] - Optional parameters.
     * @param {?Array} [options.levels=null] - Array of strings containing enum levels when `type = "Enum"`.
     * If supplied, `x` should be an array of integers that index into `levels`.
     * Alternatively, `levels` may be `null`, in which case `x` should be an array of strings that is used to infer `levels`.
     * @param {number} [options.compression=6] - Deflate compression level.
     * @param {?Array} [options.chunks=null] - Array containing the chunk dimensions.
     * This should have length equal to `shape`, with each value being no greater than the corresponding value of `shape`.
     * If `null`, it defaults to `shape`.
     * @param {boolean} [options.cache=false] - Whether to cache the written values in the returned {@linkplain H5DataSet} object.
     *
     * @return {H5DataSet} A dataset of the specified type and shape is created as an immediate child of the current group.
     * The same dataset is then filled with the contents of `x`.
     * A {@linkplain H5DataSet} object is returned representing this new dataset.
     */
     writeDataSet(name, type, shape, x, options = {}) {
        const { levels = null, compression = 6, chunks = null, cache = false, ...others } = options;
        utils.checkOtherOptions(others);

        if (x === null) {
            throw new Error("cannot write 'null' to HDF5"); 
        }

        let guessed = guess_shape(x, shape);
        x = guessed.x;
        shape = guessed.shape;

        let handle;
        if (type == "String") {
            let [ lengths, buffer ] = packer.repack_strings(x);
            try {
                let maxlen = fetch_max_string_length(lengths);
                handle = this.createDataSet(name, "String", shape, { maxStringLength: maxlen, compression: compression, chunks: chunks });
                wasm.call(module => module.write_string_hdf5_dataset(handle.file, handle.name, lengths.length, lengths.offset, buffer.offset));
            } finally {
                utils.free(lengths);
                utils.free(buffer);
            }
            handle.cache_loaded(x, cache);

        } else if (type == "Enum") {
            let processed = process_enum_input(x, levels, "x");
            handle = this.createDataSet(name, type, shape, { levels: processed.levels, compression: compression, chunks: chunks });
            handle.write(processed.values, { cache: cache });

        } else {
            handle = this.createDataSet(name, type, shape, { compression: compression, chunks: chunks });
            handle.write(x, { cache: cache });
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
     * @param {object} [options={}] - Further options to pass to the {@linkplain H5Group} constructor.
     */
    constructor(file, options = {}) {
        super(file, "/", options);
    }
}

/**
 * Create a new HDF5 file.
 *
 * @param {string} path - Path to the file.
 *
 * @return {H5File} A new file is created at `path`.
 * A {@linkplain H5File} object is returned.
 */
export function createNewHdf5File(path) {
    wasm.call(module => module.create_hdf5_file(path));
    return new H5File(path, { newlyCreated: true });
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
    #levels;
    #loaded;

    static #load(file, name) {
        let vals;
        let type;
        let shape;
        let attr;
        let levels = null;

        let x = wasm.call(module => new module.LoadedH5DataSet(file, name));
        try {
            type = x.type();
            if (type == "other") {
                throw new Error("cannot load dataset for an unsupported type");
            }

            if (type == "String") {
                vals = packer.unpack_strings(x.string_buffer(), x.string_lengths());
            } else if (type == "Enum") {
                vals = x.numeric_values().slice();
                levels = packer.unpack_strings(x.string_buffer(), x.string_lengths());
            } else {
                vals = x.numeric_values().slice();
            }

            shape = Array.from(x.shape());
            attr = packer.unpack_strings(x.attr_buffer(), x.attr_lengths());
        } finally {
            x.delete();
        }

        return { 
            "values": vals, 
            "type": type, 
            "shape": shape, 
            "levels": levels,
            "attributes": attr
        };
    }

    /**
     * @param {string} file - Path to the HDF5 file.
     * @param {string} name - Name of the dataset inside the file.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.load=false] - Whether or not to load the contents of the dataset in the constructor.
     * If `false`, the contents can be loaded later with {@linkcode H5DataSet#load load}.
     */
    constructor(file, name, options = {}) {
        const { load = false, newlyCreated = false, shape = null, type = null, values = null, ...others } = options;
        utils.checkOtherOptions(others);
        super(file, name);

        if (newlyCreated) {
            if (shape === null || type === null) {
                throw new Error("need to pass 'shape' and 'type' if 'newlyCreated = true'");
            }
            this.#shape = shape;
            this.#type = type;
            this.#values = values;
            this.#loaded = (values !== null);
            this.set_attributes([]);
        } else {
            if (!load) {
                let x = wasm.call(module => new module.H5DataSetDetails(file, name));
                try {
                    this.#type = x.type();
                    this.#shape = Array.from(x.shape());
                    this.#values = null;
                    this.set_attributes(packer.unpack_strings(x.attr_buffer(), x.attr_lengths()));
                } finally {
                    x.delete();
                }
            } else {
                let deets = H5DataSet.#load(file, name);
                this.#type = deets.type;
                this.#shape = deets.shape;
                this.#values = deets.values;
                this.#levels = deets.levels;
                this.set_attributes(deets.attributes);
            }
            this.#loaded = load;
        }
    }

    /**
     * @member {object}
     * @desc String containing the type of the dataset.
     * This may be `"IntX"` or `"UintX"` for `X` of 8, 16, 32, or 64;
     * or `"FloatX"` for `X` of 32 or 64;
     * `"String"`, `"Enum"`, or `"Other"`.
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
     * @member {?Array}
     * @desc Levels of a HDF5 enum, to be indexed by the integer `values`.
     * For non-enum data, this is set to `null`.
     */
    get levels() {
        return this.#levels;
    }

    /**
     * @return {Array|TypedArray} The contents of this dataset are loaded and cached in this {@linkplain H5DataSet} object.
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

    cache_loaded(x, cache) { // internal use only.
        if (cache) {
            this.#values = x.slice();
            this.#loaded = true;
        } else {
            this.#loaded = false;
            this.#values = null;
        }
    }

    /**
     * @param {Array|TypedArray|number|string} x - Values to write to the dataset.
     * This should be of length equal to the product of {@linkcode H5DataSet#shape shape};
     * unless `shape` is empty, in which case it should either be of length 1, or a single number or string.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.cache=false] - Whether to cache the written values in this {@linkplain H5DataSet} object.
     *
     * @return `x` is written to the dataset on file.
     * No return value is provided.
     */
    write(x, options = {}) {
        const { cache = false, ...others } = options;
        utils.checkOtherOptions(others);

        if (x === null) {
            throw new Error("cannot write 'null' to HDF5"); 
        }
        x = check_shape(x, this.shape);

        if (this.type == "String") {
            let [ lengths, buffer ] = packer.repack_strings(x);
            try {
                wasm.call(module => module.write_string_hdf5_dataset(this.file, this.name, lengths.length, lengths.offset, buffer.offset));
            } finally {
                utils.free(buffer);
                utils.free(lengths);
            }
            this.cache_loaded(x, cache);

        } else if (this.type == "Enum") {
            let y = utils.wasmifyArray(x, "Int32WasmArray");
            try {
                wasm.call(module => module.write_enum_hdf5_dataset(this.file, this.name, y.offset));
            } finally {
                y.free();
            }

        } else {
            forbid_strings(x);
            let y = utils.wasmifyArray(x, null);
            try {
                wasm.call(module => module.write_numeric_hdf5_dataset(this.file, this.name, y.constructor.className, y.offset));
                this.cache_loaded(y, cache);
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
 * For web applications, this should be saved to the virtual filesystem with {@linkcode writeFile}.
 * @param {object} [options={}] - Optional parameters.
 * @param {string} [options.group=""] - Group to use as the root of the search.
 * If an empty string is supplied, the entire file is used as the root.
 * @param {boolean} [options.recursive=true] - Whether to recursively extract names inside child groups.
 * 
 * @return {object} Nested object where the keys are the names of the HDF5 objects and values are their types.
 * HDF5 groups are represented by nested Javascript objects in the values;
 * these nested objects are empty if `recursive = false`.
 * HDF5 datasets are represented by strings specifying the data type - i.e., `"integer"`, `"float"`, `"string"` or `"other"`.
 */
export function extractHdf5ObjectNames(path, options = {}) {
    const { group = "", recursive = true, ...others } = options;
    utils.checkOtherOptions(others);

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
 * For web applications, this should be saved to the virtual filesystem with {@linkcode writeFile}.
 * @param {string} name - Name of a dataset inside the HDF5 file.
 * 
 * @return {object} An object containing:
 * - `dimensions`, an array containing the dimensions of the dataset.
 * - `contents`, a Int32Array, Float64Array or array of strings, depending on the type of the dataset. 
 */
export function loadHdf5Dataset(path, name) {
    var x = new H5DataSet(path, name, { load: true });
    return {
        "dimensions": x.shape,
        "contents": x.values
    };
}
