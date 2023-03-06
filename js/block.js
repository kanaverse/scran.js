import * as utils from "./utils.js";
import * as wa from "wasmarrays.js";
import * as fac from "./factorize.js";

/**
 * Create a blocking factor for a set of contiguous blocks, usually to accompany the output of {@linkcode cbind} on matrices representing different batches.
 * This can be used as the blocking factor in functions such as {@linkcode modelGeneVar} or {@linkcode scoreMarkers}.
 * Note that no protection is provided against empty blocks; if this is a possibility, use {@linkcode dropUnusedBlock} on the output of this function.
 *
 * @param {(Array|TypedArray)} ncells - Array of integers specifying the number of cells in each block.
 *
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
 * @param {object} [options={}] - Optional parameters.
 * @param {?Int32WasmArray} [options.buffer=null] - Array in which the output is to be stored.
 * If provided, this should be of length equal to the sum of `ncells`.
 *
 * @return {Int32WasmArray} Array containing the blocking factor.
 * Each value specifies the block of origin for each cell.
 *
 * If `buffer` was supplied, it is used as the return value. 
 */
export function createBlock(ncells, { buffer = null } = {}) {
    let total = 0;
    ncells.forEach(x => { total += x; });

    let local_buffer;
    try {
        if (buffer == null) {
            local_buffer = utils.createInt32WasmArray(total);
            buffer = local_buffer;
        } else if (buffer.length !== total) {
            throw new Error("'buffer' should have length equal to sum of 'ncells'");
        }

        let barr = buffer.array();
        let sofar = 0;
        for (var i = 0; i < ncells.length; i++) {
            let old = sofar;
            sofar += ncells[i];
            barr.fill(i, old, sofar);
        }

    } catch (e) {
        utils.free(local_buffer);
        throw e;
    }

    return buffer;
}

/**
 * Convert an existing array into a blocking factor for use in **scran.js** functions such as {@linkcode modelGeneVar} or {@linkcode scoreMarkers}.
 *
 * @param {(Array|TypedArray)} x - Array containing a blocking factor, where each unique level specifies the assigned block for each cell.
 *
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
 * @param {object} [options={}] - Optional parameters.
 * @param {?Int32WasmArray} [options.buffer=null] - Array in which the output is to be stored.
 * If provided, this should be of length equal to that of `x`.
 *
 * @return {object} Object containing `ids`, an Int32WasmArray of length equal to `x` with the block IDs for each cell;
 * and `levels`, an array of unique levels corresponding to the block IDs.
 *
 * If `buffer` was supplied, it is used as the value of the `ids` property.
 */
export function convertBlock(x, { buffer = null } = {}) {
    return fac.factorize(x, { buffer, action: "error" });
}

/**
 * Filter the blocking factor, typically based on the same filtering vector as {@linkcode filterCells}.
 * Note that no protection is provided against empty blocks; if this is a possibility, use {@linkcode dropUnusedBlock} on the output of this function.
 * 
 * @param {Int32WasmArray} x - A blocking factor, typically produced by {@linkcode convertBlock} or {@linkcode createBlock}.
 * @param {(Array|TypedArray|WasmArray)} subset - Array specifying the subset to retain or filter out, depending on `filter`.
 * 
 * If `filter = null`, the array is expected to contain integer indices specifying the entries in `x` to retain.
 * The ordering of indices in `subset` will be respected in the subsetted array.
 *
 * If `filter = true`, the array should be of length equal to that of `x`.
 * Each value is interpreted as a boolean and, if truthy, indicates that the corresponding entry of `x` should be filtered out.
 *
 * If `filter = false`, the array should be of length equal to that of `x`.
 * Each value is interpreted as a boolean and, if truthy, indicates that the corresponding entry of `x` should be retained.
 *
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
 * @param {object} [options={}] - Optional parameters.
 * @param {?boolean} [options.filter=null] - Whether to retain truthy or falsey values in a `subset` boolean filter.
 * If `null`, `subset` should instead contain the indices of elements to retain.
 * @param {?Int32WasmArray} [options.buffer=null] - Array in which the output is to be stored.
 * If provided, this should be of length equal to `subset`, if `filter = null`; 
 * the number of falsey elements in `subset`, if `filter = false`;
 * or the number of truthy elements in `subset`, if `filter = true`.
 *
 * @return {Int32WasmArray} Array containing the desired subset of `x`. 
 * If `buffer` is supplied, the returned array will be a view into `buffer`.
 */
export function subsetBlock(x, subset, { filter = null, buffer = null } = {}) {
    let len = 0;
    if (filter === null) {
        len = subset.length;
    } else {
        if (subset.length != x.length) {
            throw new Error("'x' and 'filter' should have the same length");
        }

        let sum = 0;
        subset.forEach(x => { sum += (x != 0); });
        if (filter) {
            len = subset.length - sum;
        } else {
            len = sum;
        }
    }

    let local_buffer;
    try {
        if (buffer == null) {
            local_buffer = utils.createInt32WasmArray(len);
            buffer = local_buffer;
        } else if (buffer.length !== len) {
            throw new Error("length of 'buffer' is not consistent with 'subset'");
        }

        let barr = buffer.array();
        let xarr = x.array();

        if (filter == null) {
            subset.forEach((s, i) => {
                barr[i] = xarr[s];
            });
        } else if (filter) {
            let j = 0;
            subset.forEach((y, i) => {
                if (y == 0) {
                    barr[j] = xarr[i];
                    j++;
                }
            });
        } else {
            let j = 0;
            subset.forEach((y, i) => {
                if (y !== 0) {
                    barr[j] = xarr[i];
                    j++;
                }
            });
        }

    } catch (e) {
        utils.free(local_buffer);
        throw e;
    }

    return buffer;
}

/**
 * Filter the blocking factor, typically based on the same filtering vector as {@linkcode filterCells}.
 * Note that no protection is provided against empty blocks; if this is a possibility, use {@linkcode dropUnusedBlock} on the output of this function.
 * 
 * @param {Int32WasmArray} x - A blocking factor, typically produced by {@linkcode convertBlock} or {@linkcode createBlock}.
 * @param {(Array|TypedArray|Uint8WasmArray)} filter - Array of length equal to that of `x`.
 * Each value is interpreted as a boolean and, if truthy, indicates that the corresponding entry of `x` should be filtered out.
 *
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
 * @param {object} [options={}] - Optional parameters.
 * @param {?Int32WasmArray} [options.buffer=null] - Array in which the output is to be stored.
 * If provided, this should be of length equal to the number of falsey elements in `filter`.
 *
 * @return {Int32WasmArray} Array of length equal to `x`, containing all entries of `x` for which `filter` is `false`.
 *
 * If `buffer` is supplied, it is used as the return value.
 */
export function filterBlock(x, filter, { buffer = null } = {}) {
    return subsetBlock(x, filter, { buffer: buffer, filter: true });
}

/**
 * Reindex the blocking factor to remove unused levels.
 * This is done by adjusting the blocking IDs so that every ID from `[0, N)` is represented at least once, where `N` is the number of levels.
 *
 * @param {Int32WasmArray|Array} x - A blocking factor, typically produced by {@linkcode convertBlock} or {@link createBlock}.
 *
 * @return {Array} `x` is modified in place to remove unused levels.
 *
 * An array (denoted here as `y`) is returned that represents the mapping between the original and modified IDs,
 * i.e., running `x.map(i => y[i])` will recover the input `x`.
 * This is most commonly used to create a new array of levels, i.e., `y.map(i => old_levels[i])` will drop the unused levels. 
 */
export function dropUnusedBlock(x) {
    if (x instanceof wa.WasmArray) {
        // No more wasm allocations past this point!
        x = x.array();
    }

    let uniq = new Set(x);
    let uniq_arr = Array.from(uniq).sort();
    let mapping = {};
    uniq_arr.forEach((y, i) => { mapping[y] = i; });

    x.forEach((y, i) => {
        x[i] = mapping[y];
    });

    return uniq_arr;
}
