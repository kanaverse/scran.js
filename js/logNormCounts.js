import * as gc from "./gc.js";
import * as utils from "./utils.js";
import * as wa from "wasmarrays.js";
import * as wasm from "./wasm.js";

/**
 * Compute log-transformed normalized expression values.
 *
 * @param {ScranMatrix} x The count matrix, usually after filtering.
 * @param {object} [options={}] - Optional parameters.
 * @param {?(Float64WasmArray|Array|TypedArray)} [options.sizeFactors=null] - Array of positive numbers containing the size factor for each cell in `x`.
 * This should have length equal to the number of columns in `x`.
 * If `null`, size factors are computed from the column sums of `x`.
 * @param {boolean} [options.center=true] - Whether to center the size factors so that the normalized expression values are comparable in magnitude to the input counts.
 * Set this to `false` if `sizeFactors` are provided and already centered, e.g., with {@linkcode centerSizeFactors}.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to adjust the scaling of cells in different blocks, to avoid excessive up-scaling of low-coverage blocks.
 *
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * This option is ignored if `center = false`, in which case it is assumed that scaling has already been provided in the input `sizeFactors`.
 * @param {boolean} [options.allowZeros=false] - Whether size factors of zero should be allowed.
 * If `true`, size factors of zero are converted to the smallest non-zero size factor across all cells.
 * If `false`, an error is raised instead.
 * @param {boolean} [options.allowZeros=false] - Whether non-finite size factors should be allowed.
 * If `true`, size factors of infinity or NaN are converted to the largest non-zero size factor in the dataset or 1, respectively.
 * If `false`, an error is raised instead.
 *
 * @return {ScranMatrix} A matrix of the same type as `x` containing log-transformed normalized expression values.
 */
export function logNormCounts(x, { sizeFactors = null, center = true, block = null, allowZeros = false, allowNonFinite = false } = {}) {
    var sf_data;
    var block_data;
    var output;

    try {
        var sfptr = 0;
        var use_sf = false;

        if (sizeFactors !== null) {
            sf_data = utils.wasmifyArray(sizeFactors, "Float64WasmArray");
            if (sf_data.length != x.numberOfColumns()) {
                throw new Error("length of 'sizeFactors' must be equal to number of columns in 'x'");
            }
            sfptr = sf_data.offset;
            use_sf = true;
        }

        var bptr = 0;
        var use_blocks = false;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != x.numberOfColumns()) {
                throw new Error("'block' must be of length equal to the number of columns in 'x'");
            }
            use_blocks = true;
            bptr = block_data.offset;
        }

        output = gc.call(
            module => module.log_norm_counts(x.matrix, use_sf, sfptr, use_blocks, bptr, center, allowZeros, allowNonFinite),
            x.constructor
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(sf_data);
        utils.free(block_data);
    }
    
    return output;
}

/**
 * Center size factors in preparation for log-transformation.
 * This is usually called by {@linkcode logNormCounts} internally, but can also be directly called by users to reconstitute the size factors used in the log-normalized matrix.
 *
 * @param {TypedArray|WasmArray} sizeFactors - Array of non-negative size factors, one per cell.
 * @param {object} [options={}] - Optional parameters.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell, see {@linkcode logNormCounts}.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output size factors.
 * Length should be equal to that of `sizeFactors`.
 * If `null`, an array is allocated by the function.
 *
 * @return {Float64WasmArray} Array containing the centered size factors.
 * If `buffer` is provided, it is returned directly.
 */
export function centerSizeFactors(sizeFactors, { block = null, buffer = null } = {}) {
    let local_buffer;
    let block_data;

    try {
        if (buffer === null) {
            local_buffer = utils.createFloat64WasmArray(sizeFactors.length);
            buffer = local_buffer;
        }

        if (buffer !== sizeFactors) {
            buffer.set(sizeFactors instanceof wa.WasmArray ? sizeFactors.array() : sizeFactors);
        }

        var bptr = 0;
        var use_blocks = false;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != buffer.length) {
                throw new Error("'block' must be of length equal to that of 'sizeFactors'");
            }
            use_blocks = true;
            bptr = block_data.offset;
        }

        wasm.call(module => module.center_size_factors(buffer.length, buffer.offset, use_blocks, bptr));

    } catch(e) {
        utils.free(local_buffer);
        throw e;

    } finally {
        utils.free(block_data);
    }

    return buffer;
}
