import * as utils from "./utils.js";

/**
 * Helper class for handling matrix data from multiple modalities.
 * In particular, it simplifies memory management of the assorted {@linkplain ScranMatrix} instances containing data for different features in the same set of cells.
 */
export class MultiMatrix {
    #store;
    #ncols;

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {object} [options.store={}] - Existing store of {@linkplain ScranMatrix} objects.
     * Each matrix should correspond to a different modality, named according to its key.
     * All matrices should have data for the same set of cells, i.e., same number of columns.
     */
    constructor({ store = {} } = {}) {
        this.#store = store;
        this.#ncols = null;

        let keys = Object.keys(store);
        for (var k = 0; k < keys.length; k++) {
            let current = store[keys[k]];
            if (k == 0) {
                this.#ncols = current.numberOfColumns();
            } else if (current.numberOfColumns() != this.#ncols) {
                throw new Error("all matrices should have the same number of columns");
            }
        }
    }

    /**
     * @return {?number} Number of columns in the matrices.
     * If no matrices are available, `null` is returned.
     */
    numberOfColumns() {
        return this.#ncols;
    }

    /**
     * @return {Array} Names of the available modalities.
     */
    available() {
        return Object.keys(this.#store);
    }

    /**
     * @param {string} i - Name of a modality.
     * @return {boolean} Whether modality `i` is available.
     */
    has(i) {
        return (i in this.#store);
    }

    /**
     * @param {string} i - Name of a modality.
     * @return {ScranMatrix} The matrix data for modality `i`.
     */
    get(i) {
        return this.#store[i];
    }

    /**
     * @param {string} i - Name of a modality.
     * @param {ScranMatrix} matrix - The matrix data for modality `i`.
     *
     * @return `matrix` is added to the MultiMatrix with name `i`.
     */
    add(i, matrix) {
        if (this.#ncols === null) {
            this.#ncols = matrix.numberOfColumns();
        } else if (matrix.numberOfColumns() != this.#ncols) {
            throw new Error("all matrices should have the same number of columns");
        }

        if (i in this.#store) {
            let old = this.#store[i];
            utils.free(old);
        }

        this.#store[i] = matrix;
    }

    /**
     * @param {string} i - Name of a modality.
     * @return Modality `i` is removed from the MultiMatrix.
     */
    remove(i) {
        utils.free(this.#store[i]);
        delete this.#store[i];
        if (Object.keys(this.#store).length == 0) {
            this.#ncols = null;
        }
    }

    /**
     * @param {string} i - Name of a modality.
     * @return {MultiMatrix} A deep copy of the current object. 
     */
    clone() {
        let new_matrix = new MultiMatrix;
        try {
            for (const [k, v] of Object.entries(this.#store)) {
                new_matrix.add(k, v.clone());
            }
        } catch (e) {
            new_matrix.free();
            throw e;
        }
        return new_matrix;
    }

    /**
     * @param {string} from - Old name of the modality.
     * @param {string} to - New name for the modality.
     *
     * @return The modality `from` is renamed to `to`, possibly replacing any existing modality at `to`.
     */
    rename(from, to) {
        if (from !== to) {
            if (to in this.#store) {
                utils.free(this.#store[to]);
            }
            this.#store[to] = this.#store[from];
            delete this.#store[from];
        }
    }

    /**
     * @return Frees memory for all modalities in this MultiMatrix.
     */
    free() {
        for (const [x, v] of Object.entries(this.#store)) {
            utils.free(v);
        }
        return;
    }
}
