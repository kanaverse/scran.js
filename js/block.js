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

// Soft-deprecated in favor of the more general convertToFactor().
export function convertBlock(x, { buffer = null } = {}) {
    let output = fac.convertToFactor(x, { buffer, action: "warn", placeholder: 0 });
    output.levels = output.levels.map(String);
    return output;
}

// Soft-deprecated in favor of the more general subsetFactor(), or wasmarrays.js's subsetWasmArray, take your choice.
export function subsetBlock(x, subset, { filter = null, buffer = null } = {}) {
    return wa.subsetWasmArray(x, subset, { filter, buffer });
}

// Soft-deprecated, just use subsetFactor().
export function filterBlock(x, filter, { buffer = null } = {}) {
    return subsetBlock(x, filter, { buffer: buffer, filter: true });
}

// Soft-deprecated in favor of dropUnusedLevels().
export function dropUnusedBlock(x) {
    return fac.dropUnusedLevels(x);
}
