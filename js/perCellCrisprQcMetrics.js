import * as gc from "./gc.js";
import * as utils from "./utils.js"; 

/**
 * Wrapper for the CRISPR-based metrics allocated on the Wasm heap, produced by {@linkcode perCellCrisprQcMetrics}.
 * @hideconstructor
 */
export class PerCellCrisprQcMetricsResults {
    #id;
    #results;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    // Internal use only, not documented.
    get results() {
        return this.#results;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Float64Array|Float64WasmArray} Array containing the total count across guides for each cell.
     */
    sum({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.sum(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Int32Array|Int32WasmArray} Array containing the total number of detected guides for each cell.
     */
    detected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.detected(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Float64Array|Float64WasmArray} Array containing the count of the most abundant guide for each cell.
     */
    maxValue({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.max_value(), copy);
    }

    /**
     * @return {Float64Array} Array containing the proportion of counts in the most abundant guide for each cell.
     */
    maxProportion() {
        let out = this.maxValue();
        let denom = this.sum({ copy: false });
        out.forEach((x, i) => { out[i] /= denom[i] });
        return out;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Int32Array|Int32WasmArray} Array containing the index of the most abundant guide for each cell.
     */
    maxIndex({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.max_index(), copy);
    }

    /**
     * @return {number} Number of cells in this object.
     */
    numberOfCells() {
        return this.#results.num_cells();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#results !== null) {
            gc.release(this.#id);
            this.#results = null;
        }
        return;
    }
}

/**
 * Compute per-cell QC metrics from the CRISPR guide count matrix.
 *
 * @param {ScranMatrix} x - The count matrix for CRISPR guides.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {PerCellCrisprQcMetricsResults} Object containing the QC metrics.
 */
export function perCellCrisprQcMetrics(x, { numberOfThreads = null } = {}) {
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);
    return gc.call(
        module => module.per_cell_crispr_qc_metrics(x.matrix, nthreads),
        PerCellCrisprQcMetricsResults
    );
}
