import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import * as wa from "wasmarrays.js";

/**
 * Compute per-cell scores for the activity of a feature set using the [**gsdecon**](https://github.com/libscran/gsdecon) method.
 *
 * @param {ScranMatrix} x - Log-normalized expression matrix.
 * @param {Uint8Array|Uint8WasmArray|TypedArray|Array} features - An array of length equal to the number of rows in `x`, indicating which features belong to the set.
 * A non-zero value for any entry indicates that the corresponding row of `x` is part of the feature set.
 * @param {object} [options={}] - Optional parameters.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {boolean} [options.scale=false] - Whether to scale the expression matrix to unit variance for each feature before computing the per-feature weights.
 * Setting to `true` improves robustness (or reduces sensitivity) to the behavior of highly variable features in the set.
 * @param {string} [options.blockWeightPolicy="variable"] The policy for weighting each block so that it contributes the same number of effective observations to the covariance matrix.
 *
 * - `"variable"` ensures that, past a certain size (default 1000 cells), larger blocks do not dominate the definition of the PC space.
 *   Below the threshold size, blocks are weighted in proportion to their size to reduce the influence of very small blocks. 
 * - `"equal"` uses the same weight for each block, regardless of size.
 * - `"none"` does not apply any extra weighting, i.e., the contribution of each block is proportional to its size.
 *
 * This option is only used if `block` is not `null`.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {object} Object containing:
 *
 * - `weights`, a Float64Array containing per-gene weights for each feature in the set.
 * - `scores`, a Float64Array containing the per-cell scores for each column of `x`.
 */
export function scoreGsdecon(x, features, options = {}) {
    const { block = null, scale = false, blockWeightPolicy = "variable", numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);

    let temp;
    let output = {};
    let feature_data, block_data;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        // Setting up the features.
        if (features.length !== x.numberOfRows()) {
            throw new Error("Uint8Array 'features' must be of length equal to the number of rows in 'x'");
        }
        feature_data = utils.wasmifyArray(features, "Uint8WasmArray");

        // Setting up the blocks.
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

        temp = wasm.call(module => module.score_gsdecon(x.matrix, feature_data.offset, use_blocks, bptr, scale, blockWeightPolicy, nthreads));
        output.weights = temp.weights().slice();
        output.scores = temp.scores().slice();

    } finally {
        utils.free(block_data);
        utils.free(feature_data);
        if (temp) {
            temp.delete();
        }
    }

    return output;
}
