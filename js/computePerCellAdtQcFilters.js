import * as gc from "./gc.js";
import * as utils from "./utils.js";
import * as internal from "./internal/computePerCellQcFilters.js";

/**
 * Wrapper class for the ADT-based QC filtering results, produced by {@linkcode computePerCellAdtQcFilters}.
 * @hideconstructor
 */
export class PerCellAdtQcFiltersResults {
    #results;
    #id;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Uint8Array|Uint8WasmArray} Array indicating whether each cell was filtered out due to low numbers of detected ADT features.
     */
    discardDetected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.discard_detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Uint8Array|Uint8WasmArray} Array indicating whether each cell was filtered out due to high total counts for subset `i`.
     */
    discardSubsetTotals(i, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.discard_subset_totals(i), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Uint8Array|Uint8WasmArray} Array indicating whether each cell was filtered out for any reason.
     */
   discardOverall({ copy = true } = {}) {
       return utils.possibleCopy(this.#results.discard_overall(), copy);
   }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the filtering threshold on the number of detected features for each batch.
     */
    thresholdsDetected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.thresholds_detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the filtering threshold on the total counts for subset `i` in each batch.
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
 * @param {PerCellQCMetrics} metrics - Per-cell QC metrics, usually computed by {@linkcode computePerCellAdtQcMetrics}.
 * @param {object} [options] - Optional parameters.
 * @param {number} [options.numberOfMADs=3] - Number of median absolute deviations to use to define low-quality outliers.
 * @param {number} [options.minDetectedDrop=0.1] - Minimum relative drop in the number of detected features before a cell is to be considered a low-quality cell.
 * By default, cells must exhibit at least a 10% decrease from the median before filtering is applied.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * @return {PerCellAdtQcFiltersResults} Object containing the filtering results.
 */
export function computePerCellAdtQcFilters(metrics, { numberOfMADs = 3, minDetectedDrop = 0.1, block = null } = {}) {
    return internal.computePerCellQcFilters(
        metrics, 
        block,
        x => x.detected().length,
        (x, use_blocks, bptr) => gc.call(
            module => module.per_cell_adt_qc_filters(x.results, use_blocks, bptr, numberOfMADs, minDetectedDrop),
            PerCellAdtQcFiltersResults
        )
    );
}
