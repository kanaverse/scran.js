import * as gc from "./gc.js";
import * as utils from "./utils.js"; 
import * as internal from "./internal/computePerCellQcMetrics.js";

/**
 * Wrapper for the ADT-based metrics allocated on the Wasm heap, typically produced by {@linkcode computePerCellAdtQcMetrics}.
 * @hideconstructor
 */
export class PerCellAdtQcMetricsResults {
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
     * @return {Float64Array|Float64WasmArray} Array containing the total ADT count for each cell.
     */
    sum({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.sum(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Int32Array|Int32WasmArray} Array containing the total number of detected ADT features for each cell.
     */
    detected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Float64Array|Float64WasmArray} Array containing the total count in the ADT subset `i` for each cell.
     */
    subsetSum(i, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.subset_sum(i), copy);
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
 * Compute the per-cell QC metrics from an ADT count matrix.
 *
 * @param {ScranMatrix} x - The ADT count matrix.
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
 * @return {PerCellAdtQcMetricsResults} Object containing the ADT-based QC metrics.
 */
export function perCellAdtQcMetrics(x, subsets, { numberOfThreads = null } = {}) {
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);
    return internal.computePerCellQcMetrics(
        x, 
        subsets, 
        (matrix, nsubsets, subset_offset) => gc.call(
            module => module.per_cell_adt_qc_metrics(matrix, nsubsets, subset_offset, nthreads),
            PerCellAdtQcMetricsResults
        )
    );
}
