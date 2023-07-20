import * as gc from "./gc.js";
import * as utils from "./utils.js";
import * as internal from "./internal/computePerCellQcFilters.js";
import { PerCellAdtQcMetricsResults } from "./perCellAdtQcMetrics.js";

/**
 * Wrapper class for the ADT-based QC filtering results, produced by {@linkcode suggestAdtQcFilters}.
 * @hideconstructor
 */
export class SuggestAdtQcFiltersResults {
    #results;
    #id;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * This should be set to `false` or `"view"` to modify entries, e.g., after calling creating an instance with {@linkcode emptySuggestAdtQcFiltersResults}.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array containing the filtering threshold on the number of detected ADTs for each batch.
     */
    thresholdsDetected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.thresholds_detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * This should be set to `false` or `"view"` to modify entries, e.g., after calling creating an instance with {@linkcode emptySuggestAdtQcFiltersResults}.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array containing the filtering threshold on the total counts for subset `i` in each batch.
     */
    thresholdsSubsetTotals(i, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.thresholds_subset_totals(i), copy);
    }

    /**
     * @return {number} Number of feature subsets in this object.
     */
    numberOfSubsets() {
        return this.#results.num_subsets();
    }

    /**
     * @return {number} Number of blocks in this object.
     */
    numberOfBlocks() {
        return this.#results.num_blocks();
    }

    /**
     * @param {PerCellAdtQcMetricsResults} metrics - Per-cell QC metrics, usually computed by {@linkcode perCellAdtQcMetrics}.
     * @param {object} [options={}] - Optional parameters.
     * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell in `metrics`.
     * This should have length equal to the number of cells and contain all values in `[0, n)` where `n` is the return value of {@linkcode SuggestAdtQcFilters#numberOfBlocks numberOfBlocks}.
     *
     * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
     * This will raise an error if multiple blocks were used to compute the thresholds.
     * @param {?Uint8WasmArray} [options.buffer=null] - Array of length equal to the number of cells in `metrics`, to be used to store the low-quality calls.
     *
     * @return {Uint8Array} Array of length equal to the number of cells in `metrics`.
     * Each entry is truthy if the corresponding cell is deemed to be of low-quality based on its values in `metrics`.
     * If `buffer` is supplied, the returned array is a view on `buffer`.
     */
    filter(metrics, { block = null, buffer = null } = {}) {
        if (!(metrics instanceof PerCellAdtQcMetricsResults)) {
            throw new Error("'metrics' should be a PerCellAdtQcMetricsResults object");
        }
        return internal.applyFilter(this.#results, metrics, block, buffer); 
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
 * Define filters based on the per-cell QC metrics from the ADT count matrix.
 *
 * @param {PerCellAdtQcMetricsResults} metrics - Per-cell QC metrics, usually computed by {@linkcode perCellAdtQcMetrics}.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.numberOfMADs=3] - Number of median absolute deviations to use to define low-quality outliers.
 * @param {number} [options.minDetectedDrop=0.1] - Minimum relative drop in the number of detected ADTs before a cell is to be considered a low-quality cell.
 * By default, cells must exhibit at least a 10% decrease from the median before filtering is applied.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * @return {SuggestAdtQcFiltersResults} Object containing the filtering results.
 */
export function suggestAdtQcFilters(metrics, { numberOfMADs = 3, minDetectedDrop = 0.1, block = null } = {}) {
    if (!(metrics instanceof PerCellAdtQcMetricsResults)) {
        throw new Error("'metrics' should be a PerCellAdtQcMetricsResults object");
    }
    return internal.computePerCellQcFilters(
        metrics, 
        block,
        (x, use_blocks, bptr) => gc.call(
            module => module.suggest_adt_qc_filters(x.results.$$.ptr, use_blocks, bptr, numberOfMADs, minDetectedDrop),
            SuggestAdtQcFiltersResults
        )
    );
}

/**
 * Create an empty {@linkplain SuggestAdtQcFiltersResults} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode filterCells} calls.
 *
 * @param {number} numberOfSubsets Number of feature subsets.
 * @param {number} numberOfBlocks Number of blocks in the dataset.
 *
 * @return {SuggestAdtQcFiltersResults} Object with allocated memory to store QC filters, but no actual values.
 */
export function emptySuggestAdtQcFiltersResults(numberOfSubsets, numberOfBlocks) {
    return gc.call(
        module => new module.SuggestAdtQcFilters_Results(numberOfSubsets, numberOfBlocks),
        SuggestAdtQcFiltersResults
    );
}
