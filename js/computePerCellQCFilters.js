import * as gc from "./gc.js";
import * as utils from "./utils.js";
import * as internal from "./internal/computePerCellQcFilters.js";

/**
 * Wrapper class for the filtering results, produced by {@linkcode computePerCellQCFilters}.
 * @hideconstructor
 */
export class PerCellQCFiltersResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Uint8Array|Uint8WasmArray} Array indicating whether each cell was filtered out due to low counts.
     */
    discardSums({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.discard_sums(), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Uint8Array|Uint8WasmArray} Array indicating whether each cell was filtered out due to low numbers of detected genes.
     */
    discardDetected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.discard_detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Uint8Array|Uint8WasmArray} Array indicating whether each cell was filtered out due to high proportions for subset `i`.
     */
    discardSubsetProportions(i, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.discard_proportions(i), copy);
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
     * @return {Float64Array|Float64WasmArray} Array containing the filtering threshold on the sums for each batch.
     */
    thresholdsSums({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.thresholds_sums(), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the filtering threshold on the number of detected genes for each batch.
     */
    thresholdsDetected({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.thresholds_detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the filtering threshold on the proportions for subset `i` in each batch.
     */
    thresholdsSubsetProportions(i, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.thresholds_proportions(i), copy);
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
 * Define filters based on the per-cell QC metrics.
 *
 * @param {PerCellQCMetrics} metrics - Per-cell QC metrics, usually computed by {@linkcode computePerCellQCMetrics}.
 * @param {object} [options] - Optional parameters.
 * @param {number} [options.numberOfMADs=3] - Number of median absolute deviations to use to define low-quality outliers.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * @return {PerCellQCFiltersResults} Object containing the filtering results.
 */
export function computePerCellQCFilters(metrics, { numberOfMADs = 3, block = null } = {}) {
    return internal.computePerCellQcFilters(
        metrics, 
        block,
        x => x.sums().length,
        (x, use_blocks, bptr) => gc.call(
            module => module.per_cell_qc_filters(x.results, use_blocks, bptr, numberOfMADs),
            PerCellQCFiltersResults
        )
    );
}

/**
 * Create an empty {@linkplain PerCellQCFiltersResults} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode filterCells} calls.
 * Note that filling requires use of `copy: false` in the various getters to obtain a writeable memory view.
 *
 * @param {number} numberOfCells Number of cells in the dataset.
 * @param {number} numberOfSubsets Number of feature subsets.
 * @param {number} numberOfBlocks Number of blocks in the dataset.
 *
 * @return {PerCellQCFiltersResults} Object with allocated memory to store QC filters, but no actual values.
 */
export function emptyPerCellQCFiltersResults(numberOfGenes, numberOfSubsets, numberOfBlocks) {
    return gc.call(
        module => new module.PerCellQCFilters_Results(numberOfGenes, numberOfSubsets, numberOfBlocks),
        PerCellQCFiltersResults
    );
}
