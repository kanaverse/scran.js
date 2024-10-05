import * as gc from "./gc.js";
import * as utils from "./utils.js";
import * as internal from "./internal/computePerCellQcFilters.js";
import { PerCellCrisprQcMetricsResults } from "./perCellCrisprQcMetrics.js";

/**
 * Wrapper class for the filtering results, produced by {@linkcode computeSuggestCrisprQcFilters}.
 * @hideconstructor
 */
export class SuggestCrisprQcFiltersResults {
    #id;
    #results;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * This should be set to `false` or `"view"` to modify entries, e.g., after calling creating an instance with {@linkcode emptySuggestCrisprQcFiltersResults}.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array containing the filtering threshold on the maximum count in each batch.
     */
    thresholdsMaxValue({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.thresholds_max_value(), copy);
    }

    /**
     * @ignore
     */
    thresholdsMaxCount({ copy = true } = {}) {
        return this.thresholdsMaxValue({ copy });
    }

    /**
     * @return {number} Number of blocks in this object.
     */
    numberOfBlocks() {
        return this.#results.num_blocks();
    }

    /**
     * @param {PerCellCrisprQcMetricsResults} metrics - Per-cell QC metrics, usually computed by {@linkcode perCellCrisprQcMetrics}.
     * @param {object} [options={}] - Optional parameters.
     * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell in `metrics`.
     * This should have length equal to the number of cells and contain all values in `[0, n)` where `n` is the return value of {@linkcode SuggestCrisprQcFilters#numberOfBlocks numberOfBlocks}.
     *
     * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
     * This will raise an error if multiple blocks were used to compute the thresholds.
     * @param {?Uint8WasmArray} [options.buffer=null] - Array of length equal to the number of cells in `metrics`, to be used to store the high-quality calls.
     *
     * @return {Uint8Array} Array of length equal to the number of cells in `metrics`.
     * Each entry is truthy if the corresponding cell is deemed to be of high-quality based on its values in `metrics`.
     * If `buffer` is supplied, the returned array is a view on `buffer`.
     */
    filter(metrics, { block = null, buffer = null } = {}) {
        if (!(metrics instanceof PerCellCrisprQcMetricsResults)) {
            throw new Error("'metrics' should be a PerCellCrisprQcMetricsResults object");
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
 * Define filters based on the per-cell QC metrics for CRISPR guide counts.
 *
 * @param {PerCellCrisprQcMetricsResults} metrics - Per-cell QC metrics, usually computed by {@linkcode perCellCrisprQcMetrics}.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.numberOfMADs=3] - Number of median absolute deviations to use to define low-quality outliers.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * @return {SuggestCrisprQcFiltersResults} Object containing the filtering results.
 */
export function suggestCrisprQcFilters(metrics, { numberOfMADs = 3, block = null } = {}) {
    if (!(metrics instanceof PerCellCrisprQcMetricsResults)) {
        throw new Error("'metrics' should be a PerCellCrisprQcMetricsResults object");
    }
    return internal.computePerCellQcFilters(
        metrics,
        block,
        (x, use_blocks, bptr) => gc.call(
            module => module.suggest_crispr_qc_filters(x.results, use_blocks, bptr, numberOfMADs),
            SuggestCrisprQcFiltersResults
        )
    );
}

/**
 * Create an empty {@linkplain SuggestCrisprQcFiltersResults} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode filterCells} calls.
 *
 * @param {number} numberOfBlocks Number of blocks in the dataset.
 *
 * @return {SuggestCrisprQcFiltersResults} Object with allocated memory to store QC filters, but no actual values.
 */
export function emptySuggestCrisprQcFiltersResults(numberOfBlocks) {
    return gc.call(
        module => new module.SuggestCrisprQcFiltersResults(numberOfBlocks),
        SuggestCrisprQcFiltersResults,
        /* filled = */ false 
    );
}
