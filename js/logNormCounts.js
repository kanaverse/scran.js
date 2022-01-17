import Module from "./Module.js";
import * as utils from "./utils.js";

/**
 * Compute log-transformed normalized expression values.
 *
 * @param {SparseMatrix} x The count matrix, usually after filtering.
 * @param {?(Float64WasmArray|Array|TypedArray)} sizeFactors
 * Array of positive numbers containing the size factor for each cell in `x`.
 * If `null`, size factors are computed from the column sums of `x`.
 * @param {?(Int32WasmArray|Array|TypedArray)} block Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to perform normalization within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * @param A matrix of the same type as `x` containing log-transformed normalized expression values.
 */
export function logNormCounts(x, sizeFactors = null, block = null) {
    var sf_data;
    var block_data;
    var raw;
    var output;

    try {
        var sfptr = 0;
        var use_sf = false;

        if (sizeFactors !== null) {
            sf_data = utils.wasmifyArray(sizeFactors, "Float64WasmArray");
            if (sf_data.length != x.ncol()) {
                throw "length of 'sizeFactors' must be equal to number of columns in 'x'";
            }
            sfptr = sf_data.offset;
            use_sf = true;
        }

        var bptr = 0;
        var use_blocks = false;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != x.ncol()) {
                throw "'block' must be of length equal to the number of columns in 'x'";
            }
            use_blocks = true;
            bptr = block_data.offset;
        }

        raw = utils.wrapModuleCall(() => Module.log_norm_counts(x.matrix, use_sf, sfptr, use_blocks, bptr));
        output = new x.constructor(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(sf_data);
        utils.free(block_data);
    }
    
    return output;
}
