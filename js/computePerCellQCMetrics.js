import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import * as wa from "wasmarrays.js";

/**
 * Wrapper for the metrics allocated on the Wasm heap.
 */
export class PerCellQCMetrics {
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
     */
    subsetProportions(i, { copy = true } = {}) {
        return utils.possibleCopy(this.results.subset_proportions(i), copy);
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
 * @return A `PerCellQCMetrics` object containing the QC metrics.
 */
export function computePerCellQCMetrics(x, subsets) {
    var output;
    var raw;

    try {
        if (subsets instanceof wa.Uint8WasmArray) {
            let nsubsets = Math.round(subsets.length / x.numberOfRows());
            if (nsubsets * x.numberOfRows() != subsets.length) {
                throw "length of 'subsets' should be a multiple of the matrix rows";
            }

            // This will either create a cheap view, or it'll clone
            // 'subsets' into the appropriate memory space.
            let converted = utils.wasmifyArray(subsets, null);
            try {
                let ptr = subsets.offset;
                raw = wasm.call(module => module.per_cell_qc_metrics(x.matrix, nsubsets, ptr));
            } finally {
                converted.free();
            }

        } else if (subsets instanceof Array) {
            let tmp = utils.createUint8WasmArray(x.numberOfRows() * subsets.length);
            try {
                let offset = 0;
                for (var i = 0; i < subsets.length; i++) {
                    let current = subsets[i];
                    if (current.length != x.numberOfRows()) {
                        throw "length of each array in 'subsets' should be equal to the matrix rows";
                    }
                    tmp.array().set(current, offset);
                    offset += current.length;
                }
                raw = wasm.call(module => module.per_cell_qc_metrics(x.matrix, subsets.length, tmp.offset));
            } finally {
                tmp.free();
            }

        } else if (subsets === null) {
            raw = wasm.call(module => module.per_cell_qc_metrics(x.matrix, 0, 0));

        } else {
            throw "'subsets' should be an Array or Uint8WasmArray";
        }

        output = new PerCellQCMetrics(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    }

    return output;
}
