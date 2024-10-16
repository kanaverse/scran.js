import * as gc from "./gc.js";
import * as utils from "./utils.js";

/**
 * Wrapper for the variance modelling results, produced by {@linkcode modelGeneVar}.
 * @hideconstructor
 */
export class ModelGeneVariancesResults {
    #id;
    #results;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.block=null] - Number of the block for which to extract statistics.
     * If `null`, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVariancesResults#numberOfBlocks numberOfBlocks}.
     * Ignored if {@linkcode ModelGeneVariancesResults#isBlocked isBlocked} returns false.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array of length equal to the number of genes,
     * containing the mean log-expression across all cells in the specified `block`
     * (or the average across all blocks, if `block = null`).
     */
    means(options = {}) {
        const { block = null, copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.means(block == null ? -1 : block), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.block=null] - Number of the block for which to extract statistics.
     * If `null`, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVariancesResults#numberOfBlocks numberOfBlocks}.
     * Ignored if {@linkcode ModelGeneVariancesResults#isBlocked isBlocked} returns false.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array of length equal to the number of genes,
     * containing the variance of log-expression across all cells in the specified `block`
     * (or the average across all blocks, if `block = null`).
     */
    variances(options = {}) {
        const { block = null, copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.variances(block == null ? -1 : block), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.block=null] - Number of the block for which to extract statistics.
     * If `null`, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVariancesResults#numberOfBlocks numberOfBlocks}.
     * Ignored if {@linkcode ModelGeneVariancesResults#isBlocked isBlocked} returns false.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the fitted value of the mean-variance trend for the specified `block`
     * (or the average across all blocks, if `block = null`).
     */
    fitted(options = {}) {
        const { block = null, copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.fitted(block == null ? -1 : block), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.block=null] - Number of the block for which to extract statistics.
     * If `null`, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVariancesResults#numberOfBlocks numberOfBlocks}.
     * Ignored if {@linkcode ModelGeneVariancesResults#isBlocked isBlocked} returns false.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the residuals from the mean-variance trend for the specified `block`
     * (or the average across all blocks, if `block = null`).
     */
    residuals(options = {}) {
        const { block = null, copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.residuals(block == null ? -1 : block), copy);
    }

    /**
     * @return {number} Number of blocks used.
     */
    numberOfBlocks() {
        return this.#results.num_blocks();
    }

    /**
     * @return {boolean} Whether blocking was used during trend fitting.
     */
    isBlocked() {
        return this.#results.isBlocked();
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
 * Model the mean-variance trend across genes.
 *
 * @param {ScranMatrix} x - The normalized log-expression matrix.
 * @param {object} [options={}] - Optional parameters.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to fit the mean-variance trend within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {number} [options.span=0.3] - Span to use for the LOWESS trend fitting.
 * @param {string} [options.blockWeightPolicy="variable"] The policy for weighting each block so that it has the same contribution to the average statistics.
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
 * @return {ModelGeneVariancesResults} Object containing the variance modelling results.
 */
export function modelGeneVariances(x, options = {}) {
    const { block = null, span = 0.3, blockWeightPolicy = "variable", numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);

    var block_data;
    var output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
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
            module => module.model_gene_variances(x.matrix, use_blocks, bptr, span, blockWeightPolicy, nthreads),
            ModelGeneVariancesResults
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(block_data);
    }
    
    return output;
}
