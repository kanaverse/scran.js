import * as utils from "./utils.js";

/**
 * Create a blocking factor for a set of contiguous blocks, usually to accompany the output of {@linkcode cbind} on matrices representing different batches.
 * Note that no protection is provided against empty blocks; if this is a possibility, use {@relevelBlock} on the output of this function.
 *
 * @param {(Array|TypedArray)} ncells - Array of integers specifying the number of cells in each block.
 * @param {object} [options] - Optional parameters.
 * @param {?Int32WasmArray} [options.buffer] - Array in which the output is to be stored.
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
        utils.freeCache(blocks);
        throw e;
    }

    return blocks;
}

/**
 * Convert an existing array into a blocking factor for use in **scran.js** functions.
 *
 * @param {(Array|TypedArray)} x - Array containing a blocking factor, where each unique level specifies the assigned block for each cell.
 * @param {object} [options] - Optional parameters.
 * @param {?Int32WasmArray} [options.buffer] - Array in which the output is to be stored.
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
            blocks = utils.createInt32WasmArray(total);
        } else {
            if (buffer.length !== total) {
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
        utils.freeCache(blocks);
        throw e;
    }

    return {
        ids: blocks,
        levels: levels
    };
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
export function removeUnusedBlock(x) {
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
