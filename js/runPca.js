import * as gc from "./gc.js";
import * as utils from "./utils.js";

/** 
 * Wrapper for the PCA results on the Wasm heap, typically created by {@linkcode runPca}.
 * @hideconstructor
 */
export class RunPcaResults {
    #id;
    #results;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Float64Array|Float64Wasmarray} Array containing the principal components for all cells.
     * This should be treated as a column-major array where the rows are the PCs and columns are the cells.
     */
    principalComponents(options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.components(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Float64Array|Float64Wasmarray} Array containing the rotation matrix for all cells.
     * This should be treated as a column-major array where the rows are the genes and the columns are the PCs.
     */
    rotation(options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.pcs(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Float64Array|Float64WasmArray} Array containing the variance explained for each requested PC.
     */
    varianceExplained(options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.variance_explained(), copy);
    }

    /**
     * @return {number} The total variance in the dataset,
     * typically used with {@linkcode PCAResults#varianceExplained varianceExplained} to compute the proportion of variance explained.
     */
    totalVariance() {
        return this.#results.total_variance();
    }

    /**
     * @return {number} Number of PCs available in these results.
     */
    numberOfPCs() {
        return this.#results.num_pcs();
    }

    /**
     * @return {number} Number of cells used to compute these results.
     */
    numberOfCells() {
        return this.#results.num_cells();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#results !== null) {
            gc.release(this.#id);
            this.#results = null;
        }
        return;
    }
}

/**
 * Run a principal components analysis on the log-expression matrix.
 * This is usually done on a subset of features, and possibly with some kind of blocking on a per-cell batch factor.
 *
 * @param {ScranMatrix} x - The log-normalized expression matrix.
 * @param {object} [options={}] - Optional parameters. 
 * @param {?(Uint8WasmArray|Array|TypedArray)} [options.features=null] - Array specifying which features should be retained (e.g., HVGs).
 * This should be of length equal to the number of rows in `x`; elements should be `true` to retain each row.
 * If `null`, all features are retained.
 * @param {number} [options.numberOfPCs=25] - Number of top principal components to compute.
 * @param {boolean} [options.scale=false] - Whether to scale each feature to unit variance.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {string} [options.blockMethod="regress"] - How to adjust the PCA for the blocking factor.
 *
 * - `"regress"` will regress out the factor, effectively performing a PCA on the residuals.
 *   This only makes sense in limited cases, e.g., inter-block differences are linear and the composition of each block is the same.
 * - `"project"` will compute the rotation vectors from the residuals but will project the cells onto the PC space.
 *   This focuses the PCA on within-block variance while avoiding any assumptions about the nature of the inter-block differences.
 * - `"none"` will ignore any blocking factor, i.e., as if `block = null`.
 *   Any inter-block differences will both contribute to the determination of the rotation vectors and also be preserved in the PC space.
 *
 * This option is only used if `block` is not `null`.
 * @param {string} [options.blockWeightPolicy="variable"] The policy for weighting each block so that it contributes the same number of effective observations to the covariance matrix.
 *
 * - `"variable"` ensures that, past a certain size (default 1000 cells), larger blocks do not dominate the definition of the PC space.
 *   Below the threshold size, blocks are weighted in proportion to their size to reduce the influence of very small blocks. 
 * - `"equal"` uses the same weight for each block, regardless of size.
 * - `"none"` does not apply any extra weighting, i.e., the contribution of each block is proportional to its size.
 *
 * This option is only used if `block` is not `null`.
 * @param {?boolean} [options.realizeMatrix=null] - Whether to realize the submatrix into its own memory.
 * This is more efficient but consumes more memory.
 * Defaults to true if `subset` is supplied, otherwise it is false.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {RunPcaResults} Object containing the computed PCs.
 */
export function runPca(x, options = {}) {
    let { 
        features = null,
        numberOfPCs = 25,
        scale = false,
        block = null,
        blockMethod = "regress",
        blockWeightPolicy = "variable",
        realizeMatrix = null,
        numberOfThreads = null,
        ...others
    } = options;
    utils.checkOtherOptions(others);

    var feat_data;
    var block_data;
    var output;

    utils.matchOptions("blockMethod", blockMethod, ["none", "regress", "project"]);
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        var use_feat = false;
        var fptr = 0;

        if (features !== null) {
            feat_data = utils.wasmifyArray(features, "Uint8WasmArray");
            if (feat_data.length != x.numberOfRows()) {
                throw new Error("length of 'features' should be equal to number of rows in 'x'");
            }
            use_feat = true;
            fptr = feat_data.offset;
        }

        if (realizeMatrix === null) {
            realizeMatrix = use_feat;
        }

        // Avoid asking for more PCs than is possible.
        // Remember that centering removes one df, so we subtract 1 from the dimensions.
        numberOfPCs = Math.min(numberOfPCs, x.numberOfRows() - 1, x.numberOfColumns() - 1);

        var use_block = false;
        var bptr = 0;
        var comp_as_resid = false;
        if (block !== null && blockMethod !== 'none') {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != x.numberOfColumns()) {
                throw new Error("length of 'block' should be equal to the number of columns in 'x'");
            }
            use_block = true;
            bptr = block_data.offset;
            comp_as_resid = (blockMethod == "regress");
        }

        output = gc.call(
            module => module.run_pca(x.matrix, numberOfPCs, use_feat, fptr, scale, use_block, bptr, blockWeightPolicy, comp_as_resid, realizeMatrix, nthreads),
            RunPcaResults
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(feat_data);
        utils.free(block_data);
    }

    return output;
}
