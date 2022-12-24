import * as gc from "./gc.js";
import * as utils from "./utils.js"; 

/**
 * Wrapper for the CRISPR-based metrics allocated on the Wasm heap, produced by {@linkcode perCellCrisprQcMetrics}.
 * @hideconstructor
 */
export class PerCellCrisprQcMetricsResults {
    #id;
    #results;

    #filledSums;
    #filledDetected;
    #filledMaxProportions;
    #filledMaxIndex;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;

        this.#filledSums = filled;
        this.#filledDetected = filled;
        this.#filledMaxProportions = filled;
        this.#filledMaxIndex = filled;

        return;
    }

    // Internal use only, not documented.
    get results() {
        return this.#results;
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * Automatically sets `copy = false` if `copy` was previously true.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the total count across guides for each cell.
     */
    sums({ copy = true, fillable = false } = {}) {
        copy = utils.checkFillness(fillable, copy, this.#filledSums, () => { this.#filledSums = true }, "sums");
        return utils.possibleCopy(this.#results.sums(), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * Automatically sets `copy = false` if `copy` was previously true.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the total number of detected guides for each cell.
     */
    detected({ copy = true, fillable = false } = {}) {
        copy = utils.checkFillness(fillable, copy, this.#filledDetected, () => { this.#filledDetected = true }, "detected");
        return utils.possibleCopy(this.#results.detected(), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * Automatically sets `copy = false` if `copy` was previously true.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the proportion of counts in the most abundant guide for each cell.
     */
    maxProportions({ copy = true, fillable = false } = {}) {
        copy = utils.checkFillness(fillable, copy, this.#filledMaxProportions, () => { this.#filledMaxProportions = true }, "maxProportions");
        return utils.possibleCopy(this.#results.max_proportion(), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * Automatically sets `copy = false` if `copy` was previously true.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the index of the most abundant guide for each cell.
     */
    maxIndex({ copy = true, fillable = false } = {}) {
        copy = utils.checkFillness(fillable, copy, this.#filledMaxIndex, () => { this.#filledMaxIndex = true }, "maxIndex");
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
 * @param {object} [options] - Optional parameters.
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

/**
 * Create an empty {@linkplain PerCellCrisprQcMetricsResults} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode suggestCrisprQcFilters} calls.
 * Note that filling requires use of `fillable: true` in the various getters to obtain a writeable memory view.
 *
 * @param {number} numberOfCells - Number of cells in the dataset.
 *
 * @return {PerCellCrisprQcMetricsResults} Object with allocated memory to store QC metrics, but no actual values.
 */
export function emptyPerCellCrisprQcMetricsResults(numberOfCells) {
    return gc.call(
        module => new module.PerCellCrisprQcMetrics_Results(numberOfCells),
        PerCellCrisprQcMetricsResults,
        /* filled = */ false 
    );
}
