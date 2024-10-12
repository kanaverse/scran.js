import * as gc from "./gc.js";
import * as utils from "./utils.js";
import * as internal from "./internal/computePerCellQcFilters.js";
import { PerCellRnaQcMetricsResults } from "./perCellRnaQcMetrics.js";

/**
 * Wrapper class for the filtering results, produced by {@linkcode computeSuggestRnaQcFilters}.
 * @hideconstructor
 */
export class SuggestRnaQcFiltersResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * This should be set to `false` or `"view"` to modify entries, e.g., after calling creating an instance with {@linkcode emptySuggestRnaQcFiltersResults}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the filtering threshold on the sums for each batch.
     */
    sum(options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.sum(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * This should be set to `false` or `"view"` to modify entries, e.g., after calling creating an instance with {@linkcode emptySuggestRnaQcFiltersResults}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the filtering threshold on the number of detected genes for each batch.
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
     * This should be set to `false` or `"view"` to modify entries, e.g., after calling creating an instance with {@linkcode emptySuggestRnaQcFiltersResults}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the filtering threshold on the proportions for subset `i` in each batch.
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
     * @return {number} Number of blocks in this object.
     */
    numberOfBlocks() {
        return this.#results.num_blocks();
    }

    /**
     * @return {boolean} Whether blocking was used to compute the thresholds.
     */
    isBlocked() {
        return this.#results.isBlocked();
    }

    /**
     * @param {PerCellRnaQcMetricsResults} metrics - Per-cell QC metrics, usually computed by {@linkcode perCellRnaQcMetrics}.
     * @param {object} [options={}] - Optional parameters.
     * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell in `metrics`.
     * This should have length equal to the number of cells and contain all values in `[0, n)` where `n` is the return value of {@linkcode SuggestRnaQcFilters#numberOfBlocks numberOfBlocks}.
     * `block` must be supplied if {@linkcode SuggestRnaQcFilters#isBlocked isBlocked} returns true, otherwise it is ignored.
     * @param {boolean} [options.asTypedArray=true] - Whether to return a Uint8Array.
     * If `false`, a Uint8WasmArray is returned instead.
     * @param {?Uint8WasmArray} [options.buffer=null] - Array of length equal to the number of cells in `metrics`, to be used to store the high-quality calls.
     *
     * @return {Uint8Array|Uint8WasmArray} Array of length equal to the number of cells in `metrics`.
     * Each entry is truthy if the corresponding cell is deemed to be of high-quality based on its values in `metrics`.
     * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
     */
    filter(metrics, options = {}) {
        const { block = null, asTypedArray = true, buffer = null, ...others } = options;
        utils.checkOtherOptions(others);
        if (!(metrics instanceof PerCellRnaQcMetricsResults)) {
            throw new Error("'metrics' should be a PerCellRnaQcMetricsResults object");
        }
        return internal.applyFilter(this.#results, metrics, block, asTypedArray, buffer); 
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
 * Define filters based on the per-cell QC metrics computed from an RNA count matrix.
 *
 * @param {PerCellRnaQcMetricsResults} metrics - Per-cell QC metrics, usually computed by {@linkcode perCellRnaQcMetrics}.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.numberOfMADs=3] - Number of median absolute deviations to use to define low-quality outliers.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * @return {SuggestRnaQcFiltersResults} Object containing the filtering results.
 */
export function suggestRnaQcFilters(metrics, options = {}) {
    const { numberOfMADs = 3, block = null, ...others } = options;
    utils.checkOtherOptions(others);

    if (!(metrics instanceof PerCellRnaQcMetricsResults)) {
        throw new Error("'metrics' should be a PerCellRnaQcMetricsResults object");
    }

    return internal.computePerCellQcFilters(
        metrics,
        block,
        (x, use_blocks, bptr) => gc.call(
            module => module.suggest_rna_qc_filters(x.results, use_blocks, bptr, numberOfMADs),
            SuggestRnaQcFiltersResults
        )
    );
}

/**
 * Create an empty {@linkplain SuggestRnaQcFiltersResults} object, to be filled with custom results.
 * Note that filling requires use of `fillable: true` in the various getters to obtain a writeable memory view.
 *
 * @param {number} numberOfSubsets Number of feature subsets.
 * @param {number} numberOfBlocks Number of blocks in the dataset.
 *
 * @return {SuggestRnaQcFiltersResults} Object with allocated memory to store QC filters, but no actual values.
 */
export function emptySuggestRnaQcFiltersResults(numberOfSubsets, numberOfBlocks) {
    return gc.call(
        module => new module.SuggestRnaQcFiltersResults(numberOfSubsets, numberOfBlocks),
        SuggestRnaQcFiltersResults,
        /* filled = */ false 
    );
}
