import * as utils from "./utils.js";
import * as gc from "./gc.js";

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
     * @param {object} [options] - Optional parameters.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer to extract into.
     * If supplied, this should have length equal to {@linkcode ScranMatrix#numberOfColumns numberOfColumns}.
     *
     * @return {Float64Array|undefined}
     * If `buffer` is not supplied, a Float64Array is returned containing the contents of row `i`.
     * Otherwise, `buffer` is filled with row `i` and nothing is returned.
     */
    row(i, { buffer = null } = {}) {
        if (buffer != null) {
            this.#matrix.row(i, buffer.offset);
            return;
        } else {
            var output;
            buffer = utils.createFloat64WasmArray(this.#matrix.ncol());
            try {
                this.#matrix.row(i, buffer.offset);
                output = buffer.slice();
            } finally {
                buffer.free();
            }
            return output;
        }
    }

    /**
     * @param {number} i - Index of the column to extract.
     * This should be a non-negative integer less than {@linkcode ScranMatrix#numberOfColumns numberOfColumns}.
     * @param {object} [options] - Optional parameters.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer to extract into.
     * If supplied, this should have length equal to {@linkcode ScranMatrix#numberOfRows numberOfRows}.
     *
     * @return {Float64Array|undefined}
     * If `buffer` is not supplied, a Float64Array is returned containing the contents of column `i`.
     * Otherwise, `buffer` is filled with column `i` and nothing is returned.
     */
    column(i, { buffer = null } = {}) {
        if (buffer != null) {
            this.#matrix.column(i, buffer.offset);
            return;
        } else {
            var output;
            buffer = utils.createFloat64WasmArray(this.#matrix.nrow());
            try {
                this.#matrix.column(i, buffer.offset);
                output = buffer.slice();
            } finally {
                buffer.free();
            }
            return output;
        }
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

    /**
     * @return {boolean} Whether the ScranMatrix contains a non-trivial organization of row identities.
     * If `true`, the row identities can be extracted from {@linkcode ScranMatrix#identities identities};
     * otherwise, the row identities are assumed to be consecutive increasing integers from 0 up to the number of rows.
     */
    isReorganized() {
        return this.#matrix.reorganized();
    }

    // Deprecated, kept around for back-compatibility as of 0.1.1.
    isPermuted() {
        return this.isReorganized();
    }

    /**
     * Obtain the identities of the rows of the matrix, assuming {@linkcode ScranMatrix#isReorganized isReorganized} returns `true`.
     *
     * @param {object} [options] - Optional parameters.
     * @param {?Int32WasmArray} [options.buffer=null] Buffer to extract into.
     * If supplied, this should have length equal to {@linkcode ScranMatrix#numberOfRows numberOfRows}.
     *
     * @return {Int32Array}
     * If `buffer` is not supplied, an Int32Array is returned containing the row identities.
     * These represent the row indices in the original dataset.
     *
     * If `buffer` is supplied, it is filled with the row identities.
     * A reference to `buffer` is returned.
     */
    identities({ buffer = null } = {}) {
        if (buffer != null) {
            this.#matrix.identities(buffer.offset);
            return buffer;
        } else {
            var output;
            buffer = utils.createInt32WasmArray(this.#matrix.nrow());
            try {
                this.#matrix.identities(buffer.offset);
                output = buffer.slice();
            } finally {
                buffer.free();
            }
            return output;
        }
    }
}
