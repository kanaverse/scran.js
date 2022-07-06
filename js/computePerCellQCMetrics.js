import * as gc from "./gc.js";
import * as utils from "./utils.js"; 
import * as internal from "./internal/computePerCellQcMetrics.js";

/**
 * Wrapper for the metrics allocated on the Wasm heap, produced by {@linkcode computePerCellQCMetrics}.
 * @hideconstructor
 */
export class PerCellQCMetricsResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    // Internal use only, not documented.
    get results() {
        return this.#results;
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the total count for each cell.
     */
    sums({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.sums(), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the total number of detected genes for each cell.
     */
    detected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the proportion of counts in the subset `i` for each cell.
     * If {@linkcode PerCellQCMetrics#isProportion isProportion} is `false`, the total count of subset `i` is returned instead.
     */
    subsetProportions(i, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.subset_proportions(i), copy);
    }

    /**
     * @return {boolean} Whether the subset proportions were computed in {@linkcode computePerCellQCMetrics}.
     */
    isProportion() {
        return this.#results.is_proportion();
    }

    /**
     * @return {number} Number of feature subsets in this object.
     */
    numberOfSubsets() {
        return this.#results.num_subsets();
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
 * Compute the per-cell QC metrics.
 *
 * @param {ScranMatrix} x - The count matrix.
 * @param {?Array} subsets - Array of arrays of boolean values specifying the feature subsets.
 * Each internal array corresponds to a subset and should be of length equal to the number of rows.
 * Each entry of each internal array specifies whether the corresponding row of `x` belongs to that subset; 
 * any value interpretable as a boolean can be used here.
 * 
 * Alternatively, each internal array may be any TypedArray or TypedWasmArray.
 * Each array should be of length equal to the number of rows and values are interpreted as booleans.
 *
 * Alternatively `null`, which is taken to mean that there are no subsets.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.subsetProportions=true] - Whether to compute proportions for each subset.
 * If `false`, the total count for each subset is computed instead.
 *
 * @return {PerCellQCMetricsResults} Object containing the QC metrics.
 */
export function computePerCellQCMetrics(x, subsets, { subsetProportions = true } = {}) {
    return internal.computePerCellQcMetrics(
        x, 
        subsets, 
        (matrix, nsubsets, subset_offset) => gc.call(
            module => module.per_cell_qc_metrics(matrix, nsubsets, subset_offset, subsetProportions),
            PerCellQCMetricsResults
        )
    );
}

/**
 * Create an empty {@linkplain PerCellQCMetricsResults} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode computePerCellQCFilters} calls.
 * Note that filling requires use of `copy: false` in the various getters to obtain a writeable memory view.
 *
 * @param numberOfCells Number of cells in the dataset.
 * @param numberOfSubsets Number of feature subsets.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.subsetProportions=true] - Whether to store proportions for each subset.
 * If `false`, the total count for each subset is stored instead.
 *
 * @return {PerCellQCMetricsResults} Object with allocated memory to store QC metrics, but no actual values.
 */
export function emptyPerCellQCMetricsResults(numberOfGenes, numberOfSubsets, { subsetProportions = true } = {}) {
    return gc.call(
        module => new module.PerCellQCMetrics_Results(numberOfGenes, numberOfSubsets, subsetProportions),
        PerCellQCMetricsResults
    );
}
