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
 * @param {?(Array|Uint8WasmArray)} subsets - Array of arrays of boolean values specifying the feature subsets.
 * Each internal array corresponds to a subset and should be of length equal to the number of rows.
 * Each entry of each internal array specifies whether the corresponding row of `x` belongs to that subset; 
 * any value interpretable as a boolean can be used here.
 * 
 * Alternatively, a `Uint8WasmArray` can be supplied containing the concatenated contents of all arrays;
 * this should be of length equal to the product of the number of subsets and the number of rows in `x`.
 *
 * Alternatively `null`, which is taken to mean that there are no subsets.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.subsetProportions] - Whether to compute proportions for each subset.
 * If `false`, the total count for each subset is computed instead.
 *
 * @return A `PerCellQCMetrics` object containing the QC metrics.
 */
export function computePerCellQCMetrics(x, subsets, { subsetProportions = true } = {}) {
    var output;
    var raw;

    try {
        if (subsets instanceof wa.Uint8WasmArray) {
            let nsubsets = Math.round(subsets.length / x.numberOfRows());
            if (nsubsets * x.numberOfRows() != subsets.length) {
                throw new Error("length of 'subsets' should be a multiple of the matrix rows");
            }

            // This will either create a cheap view, or it'll clone
            // 'subsets' into the appropriate memory space.
            let converted = utils.wasmifyArray(subsets, null);
            try {
                let ptr = subsets.offset;
                raw = wasm.call(module => module.per_cell_qc_metrics(x.matrix, nsubsets, ptr, subsetProportions));
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
                        throw new Error("length of each array in 'subsets' should be equal to the matrix rows");
                    }
                    tmp.array().set(current, offset);
                    offset += current.length;
                }
                raw = wasm.call(module => module.per_cell_qc_metrics(x.matrix, subsets.length, tmp.offset, subsetProportions));
            } finally {
                tmp.free();
            }

        } else if (subsets === null) {
            raw = wasm.call(module => module.per_cell_qc_metrics(x.matrix, 0, 0));

        } else {
            throw new Error("'subsets' should be an Array or Uint8WasmArray");
        }

        output = new PerCellQCMetrics(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    }

    return output;
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
    let raw;
    let output;

    try {
        raw = wasm.call(module => new module.PerCellQCMetrics_Results(numberOfGenes, numberOfSubsets, subsetProportions));
        output = new PerCellQCMetrics(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    }

    return output;
}
