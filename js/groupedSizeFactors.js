import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";
import * as wa from "wasmarrays.js";

/**
 * Compute group-based size factors, where composition biases are removed between groups and library size normalization is performed within groups.
 * This allows us to generate per-cell size factors in spite of the sparsity.
 *
 * @param {ScranMatrix} x The count matrix, usually after filtering.
 * @param {(Int32WasmArray|Array|TypedArray)} groups - Array containing the group assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of groups.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.center=true] - Whether to return centered size factors.
 * If `false`, the size factors can be interpreted as the scaling to match `reference`.
 * @param {?Float64WasmArray} [options.buffer=null] - Output buffer for the size factors.
 * This should have length equal to the number of columns in `x`.
 * @param {number} [options.priorCount=10] - Prior count to use for shrinking size factors towards the relative library size.
 * Larger values result in stronger shrinkage when the coverage is low.
 * @param {?number} [options.reference=null] - Group to use as a reference.
 * This should be an entry in `groups`. 
 * If `null`, it is automatically determined.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {Float64WasmArray} Array of length equal to the number of columns in `x`, containing the size factors for all cells.
 *
 * If `buffer` was supplied, it is used as the return value.
 */
export function groupedSizeFactors(x, groups, { center = true, buffer = null, priorCount = 10, reference = null, numberOfThreads = null } = {}) {
    var local_buffer;
    var group_arr;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        if (!(buffer instanceof wa.Float64WasmArray)) {
            local_buffer = utils.createFloat64WasmArray(x.numberOfColumns());
            buffer = local_buffer;
        } else if (buffer.length !== x.numberOfColumns()) {
            throw new Error("length of 'buffer' must be equal to the number of columns in 'x'");
        }

        group_arr = utils.wasmifyArray(groups, "Int32WasmArray");
        if (reference == null) {
            reference = -1;
        }

        wasm.call(module => module.grouped_size_factors(x.matrix, group_arr.offset, center, priorCount, reference, buffer.offset, nthreads));

    } catch (e) {
        utils.free(local_buffer);
        throw e;

    } finally {
        utils.free(group_arr);
    }
    
    return buffer;
}
