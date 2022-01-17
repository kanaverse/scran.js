import Module from "./Module.js";

/**
 * Wrapper class for the filtering results.
 */
export class PerCellQCFilters {
    /**
     * @param {Object} cpp_results Results allocated on the Wasm heap.
     *
     * This should not be called directly; use `computePerCellQCFilters` instead to create an instance of this object.
     */
    constructor(cpp_results) {
        this.results = cpp_results;
        return;
    }

    /**
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Uint8Array` (or a view thereof) indicating whether each cell was filtered out due to low counts.
     */
    discard_sums(copy = true) {
        var output = this.results.discard_sums();
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Uint8Array` (or a view thereof) indicating whether each cell was filtered out due to low numbers of detected genes.
     */
    discard_detected(copy = true) {
        var output = this.results.discard_detected();
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @param {number} i Index of the feature subset of interest.
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Uint8Array` (or a view thereof) indicating whether each cell was filtered out due to high proportions for subset `i`.
     */
    discard_subset_proportions(i, copy = true) {
        var output = this.results.discard_proportions(i);
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Uint8Array` (or a view thereof) indicating whether each cell was filtered out for any reason.
     */
   discard_overall(copy = true) {
       var output = this.results.discard_overall();
       if (copy) {
           return output.slice();
       } else {
           return output;
       }
   }

    /**
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) containing the filtering threshold on the sums for each batch.
     */
    thresholds_sums(copy = true) {
        var output = this.results.thresholds_sums();
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) containing the filtering threshold on the number of detected genes for each batch.
     */
    thresholds_detected(copy = true) {
        var output = this.results.thresholds_detected();
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @param {number} i Index of the feature subset of interest.
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) indicating containing the filtering threshold on the proportions for subset `i` in each batch.
     */
    thresholds_subset_proportions(i, copy = true) {
        var output = this.results.thresholds_proportions(i);
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @return Number of feature subsets in this object.
     */
    num_subsets() {
        return this.results.num_subsets();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        this.results.delete();
        this.results = null;
        return;
    }
}

/**
 * Define filters based on the per-cell QC metrics.
 *
 * @param {PerCellQCMetrics} metrics Per-cell QC metrics, usually computed by `computePerCellQCMetrics()`.
 * @param {number} nmads Number of median absolute deviations to use to define low-quality outliers.
 * @param {?Int32WasmArray} block Array containing the block assignment for each cell.
 * If not `null`, this should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to compute filters within each block.
 * If `null`, all cells are assumed to be in the same block.
 *
 * @return A `PerCellQCFilters` object containing the filtering results.
 */
export function computePerCellQCFilters(metrics, nmads = 3, block = null) {
    var bptr = 0;
    var use_blocks = false;

    if (block !== null) {
        if (block.size != metrics.sums().length) {
            throw "'block' must be of length equal to the number of cells in 'metrics'";
        }
        use_blocks = true;
        bptr = block.ptr;
    }

    var output;
    try {
        output = Module.per_cell_qc_filters(metrics.results, use_blocks, bptr, nmads);
    } catch(e) {
        throw Module.get_error_message(e);        
    }

    return new PerCellQCFilters(output);
}
