import * as utils from "./utils.js";

/**
 * Create a blocking factor for a set of contiguous blocks, usually to accompany the output of {@linkcode cbind} on matrices representing different batches.
 * Note that no protection is provided against empty blocks; if this is a possibility, use {@linkcode dropUnusedBlock} on the output of this function.
 *
 * @param {(Array|TypedArray)} ncells - Array of integers specifying the number of cells in each block.
 *
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
 * @param {object} [options] - Optional parameters.
 * @param {?Int32WasmArray} [options.buffer=null] - Array in which the output is to be stored.
 * If provided, this should be of length equal to the sum of `ncells`.
 *
 * @return {Int32WasmArray} Array containing the blocking factor.
 * (Or specifically, the blocking ID for each cell, which refers to the same index of `ncells`.)
 */
export function createBlock(ncells, { buffer = null } = {}) {
    let total = 0;
    ncells.forEach(x => { total += x; });

    let blocks;
    try {
        if (buffer == null) {
            blocks = utils.createInt32WasmArray(total);
        } else {
            if (buffer.length !== total) {
                throw new Error("'buffer' should have length equal to sum of 'ncells'");
            }
            blocks = buffer.view(); // create a view so that freeing inside this function is a no-op.
        }

        let barr = blocks.array();
        let sofar = 0;
        for (var i = 0; i < ncells.length; i++) {
            let old = sofar;
            sofar += ncells[i];
            barr.fill(i, old, sofar);
        }
    } catch (e) {
        utils.free(blocks);
        throw e;
    }

    return blocks;
}

/**
 * Convert an existing array into a blocking factor for use in **scran.js** functions.
 *
 * @param {(Array|TypedArray)} x - Array containing a blocking factor, where each unique level specifies the assigned block for each cell.
 *
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
 * @param {object} [options] - Optional parameters.
 * @param {?Int32WasmArray} [options.buffer=null] - Array in which the output is to be stored.
 * If provided, this should be of length equal to that of `x`.
 *
 * @return {object} Object containing `ids`, an Int32WasmArray of length equal to `x` with the block IDs for each cell;
 * and `levels`, an array of unique levels corresponding to the block IDs.
 */
export function convertBlock(x, { buffer = null } = {}) {
    let levels = [];
    let blocks;

    try {
        if (buffer == null) {
            blocks = utils.createInt32WasmArray(x.length);
        } else {
            if (buffer.length !== x.length) {
                throw new Error("'buffer' should have length equal to that of 'x'");
            }
            blocks = buffer.view();
        }

        let barr = blocks.array();
        let mapping = {};

        x.forEach((y, i) => {
            if (!(y in mapping)) {
                mapping[y] = levels.length;
                levels.push(y);
            }
            barr[i] = mapping[y];
        });

    } catch (e) {
        utils.free(blocks);
        throw e;
    }

    return {
        ids: blocks,
        levels: levels
    };
}

/**
 * Filter the blocking factor, typically based on the same filtering vector as {@linkcode filterCells}.
 * Note that no protection is provided against empty blocks; if this is a possibility, use {@linkcode dropUnusedBlock} on the output of this function.
 * 
 * @param {Int32WasmArray} x - A blocking factor, typically produced by {@linkcode convertBlock} or {@linkcode createBlock}.
 * @param {(Array|TypedArray|Uint8WasmArray)} filter - Array of length equal to that of `x`.
 * Each value is interpreted as a boolean and specifies the entry of `x` to be filtered out.
 *
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
 * @param {object} [options] - Optional parameters.
 * @param {?Int32WasmArray} [options.buffer=null] - Array in which the output is to be stored.
 * If provided, this should be of length equal to the number of `false`s in `filter`.
 *
 * @return {Int32WasmArray} Array of length equal to `x`, containing all entries of `x` for which `filter` is `false`.
 */
export function filterBlock(x, filter, { buffer = null } = {}) {
    let remaining = 0;
    filter.forEach(x => { remaining += (x == 0); });
    if (filter.length != x.length) {
        throw new Error("'x' and 'filter' should have the same length");
    }

    let blocks;
    try {
        if (buffer == null) {
            blocks = utils.createInt32WasmArray(remaining);
        } else {
            if (buffer.length !== remaining) {
                throw new Error("'buffer' should have the same length as the number of falses in 'filter'");
            }
            blocks = buffer.view();            
        }

        let j = 0;
        let barr = blocks.array();
        let xarr = x.array();
        filter.forEach((y, i) => {
            if (y == 0) {
                barr[j] = xarr[i];
                j++;
            }
        });

    } catch (e) {
        utils.free(blocks);
        throw e;
    }

    return blocks;
}

/**
 * Reindex the blocking factor to remove unused levels.
 * This is done by adjusting the blocking IDs so that every ID from `[0, N)` is represented at least once, where `N` is the number of levels.
 *
 * @param {Int32WasmArray} x - A blocking factor, typically produced by {@linkcode convertBlock} or {@link createBlock}.
 *
 * @return {Array} `x` is modified in place to remove unused levels.
 * An array is returned that represents the mapping between the original and modified IDs.
 */
export function dropUnusedBlock(x) {
    let uniq = new Set(x.array())
    let uniq_arr = Array.from(uniq).sort();
    let mapping = {};
    uniq_arr.forEach((y, i) => { mapping[y] = i; });

    let x_arr = x.array();
    x.forEach((y, i) => {
        x_arr[i] = mapping[y];
    });

    return uniq_arr;
}
