import * as gc from "./gc.js";
import * as utils from "./utils.js";

/**
 * Compute log-transformed normalized expression values.
 *
 * @param {ScranMatrix} x The count matrix, usually after filtering.
 * @param {object} [options] - Optional parameters.
 * @param {?(Float64WasmArray|Array|TypedArray)} [options.sizeFactors=null] - Array of positive numbers containing the size factor for each cell in `x`.
 * This should have length equal to the number of columns in `x`.
 * If `null`, size factors are computed from the column sums of `x`.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to adjust the scaling of cells in different blocks, to avoid excessive up-scaling of low-coverage blocks.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {boolean} [options.allowZeros=false] - Whether size factors of zero should be allowed.
 * If `true`, no scaling normalization is performed for the corresponding cells, under the assumption they are all-zero libraries.
 * If `false`, an error is raised instead.
 *
 * @return {ScranMatrix} A matrix of the same type as `x` containing log-transformed normalized expression values.
 */
export function logNormCounts(x, { sizeFactors = null, block = null, allowZeros = false } = {}) {
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
            module => module.log_norm_counts(x.matrix, use_sf, sfptr, use_blocks, bptr, allowZeros),
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
