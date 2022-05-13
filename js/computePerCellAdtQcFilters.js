import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import * as internal from "./internal/computePerCellQcFilters.js";

/**
 * Wrapper class for the ADT-based QC filtering results.
 */
export class PerCellAdtQcFilters {
    /**
     * @param {Object} raw Raw results allocated on the Wasm heap.
     *
     * This should not be called directly; use `computePerCellAdtQcFilters` instead to create an instance of this object.
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
     * @return A `Uint8Array` (or a view thereof) indicating whether each cell was filtered out due to low numbers of detected ADT features.
     */
    discardDetected({ copy = true } = {}) {
        return utils.possibleCopy(this.results.discard_detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Uint8Array` (or a view thereof) indicating whether each cell was filtered out due to high total counts for subset `i`.
     */
    discardSubsetTotals(i, { copy = true } = {}) {
        return utils.possibleCopy(this.results.discard_subset_totals(i), copy);
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Uint8Array` (or a view thereof) indicating whether each cell was filtered out for any reason.
     */
   discardOverall({ copy = true } = {}) {
       return utils.possibleCopy(this.results.discard_overall(), copy);
   }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) containing the filtering threshold on the number of detected features for each batch.
     */
    thresholdsDetected({ copy = true } = {}) {
        return utils.possibleCopy(this.results.thresholds_detected(), copy);
    }

    /**
     * @param {number} i - Index of the feature subset of interest.
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) indicating containing the filtering threshold on the total counts for subset `i` in each batch.
     */
    thresholdsSubsetTotals(i, { copy = true } = {}) {
        return utils.possibleCopy(this.results.thresholds_subset_totals(i), copy);
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
 * Define filters based on the per-cell QC metrics from the ADT count matrix.
 *
 * @param {PerCellQCMetrics} metrics - Per-cell QC metrics, usually computed by `computePerCellAdtQcMetrics()`.
 * @param {Object} [options] - Optional parameters.
 * @param {number} [options.numberOfMADs] - Number of median absolute deviations to use to define low-quality outliers.
 * @param {number} [options.minDetectedDrop] - Minimum relative drop in the number of detected features before a cell is to be considered a low-quality cell.
 * By default, cells must exhibit at least a 10% decrease from the median before filtering is applied.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * @return A `PerCellQCFilters` object containing the filtering results.
 */
export function computePerCellAdtQcFilters(metrics, { numberOfMADs = 3, minDetectedDrop = 0.1, block = null } = {}) {
    return internal.computePerCellQcFilters(
        metrics, 
        block,
        x => x.detected().length,
        (x, use_blocks, bptr) => wasm.call(module => module.per_cell_adt_qc_filters(x.results, use_blocks, bptr, numberOfMADs, minDetectedDrop)),
        raw => new PerCellAdtQcFilters(raw)
    );
}
