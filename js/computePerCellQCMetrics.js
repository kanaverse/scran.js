import Module from "./Module.js";
import { Uint8WasmArray } from "./WasmArray.js";

/**
 * Wrapper for the metrics allocated on the Wasm heap.
 */
export class PerCellQCMetrics {
    /**
     * @param {Object} cpp_results Results allocated on the Wasm heap.
     *
     * This should not be called directly; use `computePerCellQCMetrics` instead to create an instance of this object.
     */
    constructor(cpp_results) {
        this.results = cpp_results;
        return;
    }

    /**
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) containing the total count for each cell.
     */
    sums(copy = true) {
        var output = this.results.sums();
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
     * @return An `Int32Array` (or a view thereof) containing the total number of detected genes for each cell.
     */
    detected(copy = true) {
        var output = this.results.detected();
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
     * @return A `Float64Array` (or a view thereof) containing the proportion of counts in the subset `i` for each cell.
     */
    subset_proportions(i, copy = true) {
        var output = this.results.subset_proportions(i);
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
 * Compute the per-cell QC metrics.
 *
 * @param {SparseMatrix} x The count matrix.
 * @param {(Array|Uint8WasmArray)} subsets 
 * An array of arrays of boolean values specifying the feature subsets.
 * Each internal array corresponds to a subset and should be of length equal to the number of rows.
 * Each entry of each internal array specifies whether the corresponding row of `x` belongs to that subset; 
 * any value interpretable as a boolean can be used here.
 * Alternatively, a `Uint8WasmArray` can be supplied containing the concatenated contents of all arrays;
 * this should be of length equal to the product of the number of subsets and the number of rows in `x`.
 *
 * @return A `PerCellQCMetrics` object containing the QC metrics.
 */
export function computePerCellQCMetrics(x, subsets) {
    var output;

    if (subsets instanceof Uint8WasmArray) {
        let ptr = subsets.ptr;
        let nsubsets = Math.round(subsets.size / x.nrow());
        if (nsubsets * x.nrow() != subsets.size) {
            throw "length of 'subsets' should be a multiple of the matrix rows";
        }

        try { 
            output = Module.per_cell_qc_metrics(x.matrix, nsubsets, ptr);
        } catch (e) {
            throw Module.get_error_message(e);
        }

    } else if (subsets instanceof Array) {
        let tmp = new Uint8WasmArray(x.nrow() * subsets.length);
        try {
            let offset = 0;
            for (var i = 0; i < subsets.length; i++) {
                let current = subsets[i];
                if (current.length != x.nrow()) {
                    throw "length of each array in 'subsets' should be equal to the matrix rows";
                }
                tmp.array().set(current, offset);
                offset += current.length;
            }

            try { 
                output = Module.per_cell_qc_metrics(x.matrix, subsets.length, tmp.ptr);
            } catch (e) {
                throw Module.get_error_message(e);
            }
        } finally {
            tmp.free();
        }
    } else {
        throw "'subsets' should be an Array or Uint8WasmArray";
    }

    return new PerCellQCMetrics(output);
}
