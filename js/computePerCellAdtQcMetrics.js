import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import * as internal from "./internal/computePerCellQcMetrics.js";

/**
 * Wrapper for the ADT-based metrics allocated on the Wasm heap.
 */
export class PerCellAdtQcMetrics {
    /**
     * @param {Object} raw Raw results allocated on the Wasm heap.
     *
     * This should not be called directly; use `computePerCellAdtQcMetrics` instead to create an instance of this object.
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
     * @return A `Float64Array` (or a view thereof) containing the total ADT count for each cell.
     */
    sums({ copy = true } = {}) {
        return utils.possibleCopy(this.results.sums(), copy);
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return An `Int32Array` (or a view thereof) containing the total number of detected ADT features for each cell.
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
     * @return A `Float64Array` (or a view thereof) containing the total count in the ADT subset `i` for each cell.
     */
    subsetTotals(i, { copy = true } = {}) {
        return utils.possibleCopy(this.results.subset_totals(i), copy);
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
 * Compute the per-cell QC metrics from an ADT count matrix.
 *
 * @param {ScranMatrix} x - The ADT count matrix.
 * @param {?(Array|Uint8WasmArray)} subsets - Array of arrays of boolean values specifying the feature subsets.
 * Each internal array corresponds to a subset and should be of length equal to the number of rows.
 * Each entry of each internal array specifies whether the corresponding row of `x` belongs to that subset; 
 * any value interpretable as a boolean can be used here.
 * 
 * Alternatively, a `Uint8WasmArray` can be supplied containing the concatenated contents of all arrays;
 * this should be of length equal to the product of the number of subsets and the number of rows in `x`.
 *
 * Alternatively `null`, which is taken to mean that there are no subsets.
 *
 * @return {PerCellAdtQcMetrics} Object containing the ADT-based QC metrics.
 */
export function computePerCellAdtQcMetrics(x, subsets) {
    return internal.computePerCellQcMetrics(x, subsets, 
        (matrix, nsubsets, subset_offset) => {
            return wasm.call(module => module.per_cell_adt_qc_metrics(matrix, nsubsets, subset_offset));
        },
        raw => {
            return new PerCellAdtQcMetrics(raw);
        }
    );
}

/**
 * Create an empty {@linkplain PerCellAdtQcMetrics} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode computePerCellAdtQcFilters} calls.
 * Note that filling requires use of `copy: false` in the various getters to obtain a writeable memory view.
 *
 * @param numberOfCells Number of cells in the dataset.
 * @param numberOfSubsets Number of feature subsets.
 *
 * @return {PerCellAdtQcMetrics} Object with allocated memory but no actual values.
 */
export function emptyPerCellAdtQcMetrics(numberOfGenes, numberOfSubsets) {
    return internal.emptyPerCellQcMetrics(
        () => wasm.call(module => new module.PerCellAdtQcMetrics_Results(numberOfGenes, numberOfSubsets)),
        raw => new PerCellAdtQcMetrics(raw)
    );
}
