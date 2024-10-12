import * as utils from "./utils.js";
import * as gc from "./gc.js";
import * as wa from "wasmarrays.js";

/**
 * Wrapper around a matrix allocated on the Wasm heap.
 * @hideconstructor
 */
export class ScranMatrix {
    #id;
    #matrix;

    constructor(id, raw) {
        this.#id = id;
        this.#matrix = raw;
        return;
    }

    /**
     * @return {ScranMatrix} A clone of the current ScranMatrix instance.
     * This can be freed independently of the current instance.
     */
    clone() {
        return gc.call(
            module => this.#matrix.clone(),
            ScranMatrix
        );
    }

    // Internal use only, not documented.
    get matrix() {
        return this.#matrix;
    }

    /**
     * @return {number} Number of rows in the matrix.
     */
    numberOfRows() {
        return this.#matrix.nrow();
    }

    /**
     * @return {number} Number of columns in the matrix.
     */
    numberOfColumns() {
        return this.#matrix.ncol();
    }

    /**
     * @param {number} i - Index of the row to extract.
     * This should be a non-negative integer less than {@linkcode ScranMatrix#numberOfRows numberOfRows}.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
     * If `false`, a Float64WasmArray is returned instead.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer for storing the extracted data.
     * If supplied, this should have length equal to {@linkcode ScranMatrix#numberOfColumns numberOfColumns}.
     *
     * @return {Float64Array|Float64WasmArray} An array containing the contents of row `i`.
     * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
     */
    row(i, options = {}) {
        let { asTypedArray = true, buffer = null, ...others } = options;
        utils.checkOtherOptions(others);
        let tmp = null;

        try {
            if (buffer == null) {
                tmp = utils.createFloat64WasmArray(this.#matrix.ncol());
                buffer = tmp;
            }
            this.#matrix.row(i, buffer.offset);
        } catch (e) {
            utils.free(tmp);
            throw e;
        }

        return utils.toTypedArray(buffer, tmp == null, asTypedArray);
    }

    /**
     * @param {number} i - Index of the column to extract.
     * This should be a non-negative integer less than {@linkcode ScranMatrix#numberOfColumns numberOfColumns}.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
     * If `false`, a Float64WasmArray is returned instead.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer for storing the extracted data.
     * If supplied, this should have length equal to {@linkcode ScranMatrix#numberOfRows numberOfRows}.
     *
     * @return {Float64Array|Float64WasmArray} An array containing the contents of column `i`.
     * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
     */
    column(i, options = {}) {
        let { asTypedArray = true, buffer = null, ...others } = options;
        utils.checkOtherOptions(others);
        let tmp = null;

        try {
            if (buffer == null) {
                tmp = utils.createFloat64WasmArray(this.#matrix.nrow());
                buffer = tmp;
            }
            this.#matrix.column(i, buffer.offset);
        } catch (e) {
            utils.free(tmp);
            throw e;
        }

        return utils.toTypedArray(buffer, tmp == null, asTypedArray);
    }

    /** 
     * Free the memory on the Wasm heap for this.#matrix.
     * This invalidates this object and all of its references.
     */
    free() {
        if (this.#matrix !== null) {
            gc.release(this.#id);
            this.#matrix = null;
        }
        return;
    }

    /**
     * @return {boolean} Whether the matrix is sparse.
     */
    isSparse() {
        return this.#matrix.sparse();
    }
}
