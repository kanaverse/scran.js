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

    #filledSums;
    #filledDetected;
    #filledSubsetTotals;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;

        this.#filledSums = filled;
        this.#filledDetected = filled;
        this.#filledSubsetTotals = utils.spawnArray(this.numberOfSubsets(), filled);

        return;
    }

    // Internal use only, not documented.
    get results() {
        return this.#results;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array containing the total ADT count for each cell.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    sums({ copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledSums, 
            () => { this.#filledSums = true }, 
            COPY => utils.possibleCopy(this.#results.sums(), COPY)
        );
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Int32Array|Int32WasmArray)} Array containing the total number of detected ADT features for each cell.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    detected({ copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledDetected, 
            () => { this.#filledDetected = true }, 
            COPY => utils.possibleCopy(this.#results.detected(), COPY)
        );
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {?boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array containing the total count in the ADT subset `i` for each cell.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    subsetTotals(i, { copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledSubsetTotals[i], 
            () => { this.#filledSubsetTotals[i] = true }, 
            COPY => utils.possibleCopy(this.#results.subset_totals(i), COPY)
        );
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

/**
 * Create an empty {@linkplain PerCellAdtQcMetricsResults} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode computePerCellAdtQcFilters} calls.
 * Note that filling requires use of `fillable: true` in the various getters to obtain a writeable memory view.
 *
 * @param {number} numberOfCells - Number of cells in the dataset.
 * @param {number} numberOfSubsets - Number of feature subsets.
 *
 * @return {PerCellAdtQcMetricsResults} Object with allocated memory but no actual values.
 */
export function emptyPerCellAdtQcMetricsResults(numberOfCells, numberOfSubsets) {
    return gc.call(
        module => new module.PerCellAdtQcMetrics_Results(numberOfCells, numberOfSubsets),
        PerCellAdtQcMetricsResults,
        /* filled = */ false 
    );
}
