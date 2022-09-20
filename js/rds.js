import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import * as gc from "./gc.js";
import * as h5 from "./hdf5.js";

/**
 * Base class for RDS objects.
 * @hideconstructor
 */
export class RdsObject {
    constructor(id, raw, par) {
        this.id = id;
        this.object = raw;
        this.parent = par;
    }

    /**
     * @return {string} Type of the object.
     */
    type() {
        return this.object.type();
    }

    /**
     * Free the memory on the Wasm heap for this object.
     */
    free() {
        if (this.object !== null) {
            gc.release(this.id);
            this.object = null;
        }
    }
}

/**
 * Vector-like R object.
 *
 * @augments RdsObject
 * @hideconstructor
 */
export class RdsVector extends RdsObject {
    constructor(id, raw, par) {
        super(id, raw, par);
    }

    /**
     * @return{number} Length of the vector.
     */
    length() {
        return this.object.size();
    }

    /**
     * @return {Array} Names of all attributes.
     */
    attributeNames() {
        return wasm.call(mod => {
            this.object.fill_attribute_names();
            let anames_buf = this.object.attribute_names_buffer();
            let anames_len = this.object.attribute_names_length();
            return h5.unpack_strings(anames_buf, anames_len);
        });
    }

    /**
     * @param {string} name - Name of the attribute of interest.
     * @return {number} Index of `name` in the array of attributes from {@linkcode RdsVector#attributeNames attributeNames}.
     * If `name` is not present, -1 is returned.
     */
    findAttribute(name) {
        return wasm.call(mod => this.object.find_attribute(name));
    }

    /**
     * @param {number} index - Index of the attribute of interest.
     * @return {RdsObject} Value of the attribute.
     */
    attribute(index) {
        return dispatch(mod => this.object.load_attribute(index), this.parent);
    }
}

/**
 * Integer vector from R.
 *
 * @augments RdsVector 
 * @hideconstructor
 */
export class RdsIntegerVector extends RdsVector {
    constructor(id, raw, par) {
        super(id, raw, par);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Values of the integer vector.
     */
    values({ copy = true } = {}) {
        return utils.possibleCopy(this.object.numeric_vector(), copy);
    }
}

/**
 * Logical (i.e., boolean) vector from R.
 *
 * @augments RdsVector 
 * @hideconstructor
 */
export class RdsLogicalVector extends RdsVector {
    constructor(id, raw, par) {
        super(id, raw, par);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Values of the logical vector.
     * Zero values are falsey and values of 1 are truthy.
     */
    values({ copy = true } = {}) {
        return utils.possibleCopy(this.object.numeric_vector(), copy);
    }
}

/**
 * Double-precision vector from R.
 *
 * @augments RdsVector 
 * @hideconstructor
 */
export class RdsDoubleVector extends RdsVector {
    constructor(id, raw, par) {
        super(id, raw, par);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Values of the double vector.
     */
    values({ copy = true } = {}) {
        return utils.possibleCopy(this.object.numeric_vector(), copy);
    }
}

/**
 * String vector from R.
 *
 * @augments RdsVector 
 * @hideconstructor
 */
export class RdsStringVector extends RdsVector {
    constructor(id, raw, par) {
        super(id, raw, par);
    }

    /**
     * @return {Array} Values of the string vector.
     */
    values() {
        return wasm.call(mod => {
            this.object.fill_string_vector();
            let buf = this.object.string_vector_buffer();
            let len = this.object.string_vector_length();
            return h5.unpack_strings(buf, len);
        });
    }
}

/**
 * Generic vector from R, typically known as a "list".
 *
 * @augments RdsVector 
 * @hideconstructor
 */
export class RdsGenericVector extends RdsVector {
    constructor(id, raw, par) {
        super(id, raw, par);
    }

    /**
     * @param {number} index - Index of the list element of interest.
     * @return {RdsObject} Value of the list element.
     */
    load(index) {
        return dispatch(mod => this.object.load_list_element(index), this.parent);
    }
}

/**
 * S4 object from R, containing slot data in its attributes.
 *
 * @augments RdsObject
 * @hideconstructor
 */
export class RdsS4Object extends RdsVector {
    constructor(id, raw, par) {
        super(id, raw, par);
    }

    /**
     * Name of the R class.
     */
    className() {
        return wasm.call(mod => this.object.class_name());
    }

    /**
     * Name of the package that defines the class.
     */
    packageName() {
        return wasm.call(mod => this.object.class_name());
    }
}

function dispatch(fun, par) {
    let obj = wasm.call(fun);

    let tt = null;
    try {
        tt = obj.type();
    } catch (e) {
        obj.delete();
        throw e;
    }

    // Remaining steps until gc.call() should be no-throw!
    let cons;
    if (tt == "integer") {
        cons = RdsIntegerVector;
    } else if (tt == "double") {
        cons = RdsDoubleVector;
    } else if (tt == "logical") {
        cons = RdsLogicalVector;
    } else if (tt == "string") {
        cons = RdsStringVector;
    } else if (tt == "vector") {
        cons = RdsGenericVector;
    } else if (tt == "S4") {
        cons = RdsS4Object;
    } else {
        cons = RdsObject;
    }

    return gc.call(mod => obj, cons, par);
}

/**
 * Details of the RDS file.
 */
export class RdsDetails {
    #id;
    #obj;

    constructor(id, obj) {
        this.#id = id;
        this.#obj = obj;
    }

    /**
     * @return {number} Version of the RDS format. This should be 3.
     */
    formatVersion() {
        return this.#obj.format_version();
    }

    /**
     * @return {string} The R version used to create the file.
     */
    writerVersion() {
        let info = this.#obj.writer_version();
        return String(info[0]) + "." + String(info[1]) + "." + String(info[2]);
    }

    /**
     * @return {string} The minimum R version that can read the file.
     */
    readerVersion() {
        let info = this.#obj.reader_version();
        return String(info[0]) + "." + String(info[1]) + "." + String(info[2]);
    }

    /**
     * @return {RdsObject} Interface into the underlying R object.
     */
    value() {
        return dispatch(mod => this.#obj.load(), this); 
    }

    /**
     * Free the memory on the Wasm heap for this object.
     * Doing so will invalidate all {@linkplain RdsObject} instances derived from this object, 
     * directly via {@linkcode RdsDetails#load} or indirectly 
     * (e.g., from further {@linkcode RdsVector#attribute RdsVector.attribute} or {@linkcode RdsGenericVector#load RdsGenericVector.load} calls).
     */
    free() {
        if (this.#obj !== null) {
            gc.release(this.#id);
            this.#obj = null;
        }
    }
}

/**
 * Read the contents of an RDS file.
 *
* @param {Uint8WasmArray|Array|TypedArray|string} buffer Byte array containing the contents of an RDS file.
 * This can be raw text or Gzip-compressed.
 * 
 * Alternatively, this can be a string containing a file path to a MatrixMarket file.
 *
 * @return {RdsDetails} Details of the file.
 */
export function readRds(x) {
    let tmp;
    let output;

    try {
        if (typeof x == "string") {
            output = gc.call(module => module.parse_rds_from_file(x), RdsDetails)
        } else {
            tmp = utils.wasmifyArray(x, "Uint8WasmArray");
            output = gc.call(module => module.parse_rds_from_buffer(tmp.offset, tmp.length), RdsDetails);
        }
    } finally {
        utils.free(tmp);
    }

    return output;
}

