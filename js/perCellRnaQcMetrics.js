import * as gc from "./gc.js";
import * as utils from "./utils.js"; 
import * as internal from "./internal/computePerCellQcMetrics.js";

/**
 * Wrapper for the RNA-based metrics allocated on the Wasm heap, produced by {@linkcode perCellRnaQcMetrics}.
 * @hideconstructor
 */
export class PerCellRnaQcMetricsResults {
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
     * @return {Float64Array|Float64WasmArray} Array containing the total count across genes for each cell.
     */
    sum(options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.sum(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Int32Array|Int32WasmArray} Array containing the total number of detected genes for each cell.
     */
    detected(options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Float64Array|Float64WasmArray} Array containing the proportion of counts in the subset `i` for each cell.
     */
    subsetProportion(i, options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.subset_proportion(i), copy);
    }

    /**
     * @return {number} Number of feature subsets in this object.
     */
    numberOfSubsets() {
        return this.#results.num_subsets();
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
 * Compute per-cell QC metrics from the RNA count matrix.
 *
 * @param {ScranMatrix} x - The RNA count matrix for genes.
 * @param {?Array} subsets - Array of arrays of boolean values specifying the feature subsets.
 * Each internal array corresponds to a subset and should be of length equal to the number of rows.
 * Each entry of each internal array specifies whether the corresponding row of `x` belongs to that subset; 
 * any value interpretable as a boolean can be used here.
 * 
 * Alternatively, each internal array may be any TypedArray or TypedWasmArray.
 * Each array should be of length equal to the number of rows and values are interpreted as booleans.
 *
 * Alternatively `null`, which is taken to mean that there are no subsets.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {PerCellRnaQcMetricsResults} Object containing the QC metrics.
 */
export function perCellRnaQcMetrics(x, subsets, options = {}) {
    const { numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);
    return internal.computePerCellQcMetrics(
        x, 
        subsets, 
        (matrix, nsubsets, subset_offset) => gc.call(
            module => module.compute_rna_qc_metrics(matrix, nsubsets, subset_offset, nthreads),
            PerCellRnaQcMetricsResults
        )
    );
}
