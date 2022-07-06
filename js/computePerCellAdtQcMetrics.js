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
     * @return {Float64Array|Float64WasmArray} Array containing the total ADT count for each cell.
     */
    sums({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.sums(), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the total number of detected ADT features for each cell.
     */
    detected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the total count in the ADT subset `i` for each cell.
     */
    subsetTotals(i, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.subset_totals(i), copy);
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
 *
 * @return {PerCellAdtQcMetricsResults} Object containing the ADT-based QC metrics.
 */
export function computePerCellAdtQcMetrics(x, subsets) {
    return internal.computePerCellQcMetrics(
        x, 
        subsets, 
        (matrix, nsubsets, subset_offset) => gc.call(
            module => module.per_cell_adt_qc_metrics(matrix, nsubsets, subset_offset),
            PerCellAdtQcMetricsResults
        )
    );
}

/**
 * Create an empty {@linkplain PerCellAdtQcMetricsResults} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode computePerCellAdtQcFilters} calls.
 * Note that filling requires use of `copy: false` in the various getters to obtain a writeable memory view.
 *
 * @param numberOfCells Number of cells in the dataset.
 * @param numberOfSubsets Number of feature subsets.
 *
 * @return {PerCellAdtQcMetricsResults} Object with allocated memory but no actual values.
 */
export function emptyPerCellAdtQcMetricsResults(numberOfGenes, numberOfSubsets) {
    return gc.call(
        module => new module.PerCellAdtQcMetrics_Results(numberOfGenes, numberOfSubsets),
        PerCellAdtQcMetricsResults
    );
}
