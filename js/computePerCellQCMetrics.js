import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import * as internal from "./internal/computePerCellQcMetrics.js";

/**
 * Wrapper for the metrics allocated on the Wasm heap.
 */
export class PerCellQCMetricsResults {
    /**
     * @param {Object} raw Raw results allocated on the Wasm heap.
     *
     * This should not be called directly; use `computePerCellQCMetrics` instead to create an instance of this object.
     */
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) containing the total count for each cell.
     */
    sums({ copy = true } = {}) {
        return utils.possibleCopy(this.results.sums(), copy);
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return An `Int32Array` (or a view thereof) containing the total number of detected genes for each cell.
     */
    detected({ copy = true } = {}) {
        return utils.possibleCopy(this.results.detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) containing the proportion of counts in the subset `i` for each cell.
     * If {@linkcode PerCellQCMetrics#isProportion isProportion} is `false`, the total count of subset `i` is returned instead.
     */
    subsetProportions(i, { copy = true } = {}) {
        return utils.possibleCopy(this.results.subset_proportions(i), copy);
    }

    /**
     * @return Whether the subset proportions were computed in {@linkcode computePerCellQCMetrics}.
     */
    isProportion() {
        return this.results.is_proportion();
    }

    /**
     * @return Number of feature subsets in this object.
     */
    numberOfSubsets() {
        return this.results.num_subsets();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.results !== null) {
            this.results.delete();
            this.results = null;
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
 * @param {boolean} [options.subsetProportions] - Whether to compute proportions for each subset.
 * If `false`, the total count for each subset is computed instead.
 *
 * @return A `PerCellQCMetrics` object containing the QC metrics.
 */
export function computePerCellQCMetrics(x, subsets, { subsetProportions = true } = {}) {
    return internal.computePerCellQcMetrics(
        x, 
        subsets, 
        (matrix, nsubsets, subset_offset) => wasm.call(module => module.per_cell_qc_metrics(matrix, nsubsets, subset_offset, subsetProportions)),
        raw => new PerCellQCMetricsResults(raw)
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
 * @param {boolean} [options.subsetProportions] - Whether to store proportions for each subset.
 * If `false`, the total count for each subset is stored instead.
 *
 * @return A {@linkplain PerCellQCMetricsResults} object with allocated memory but no actual values.
 */
export function emptyPerCellQCMetricsResults(numberOfGenes, numberOfSubsets, { subsetProportions = true } = {}) {
    return internal.emptyPerCellQcMetricsResults(
        () => wasm.call(module => new module.PerCellQCMetrics_Results(numberOfGenes, numberOfSubsets, subsetProportions)),
        raw => new PerCellQCMetricsResults(raw)
    );
}
