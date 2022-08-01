import * as gc from "./gc.js";
import * as utils from "./utils.js";

/** 
 * Wrapper for the PCA results on the Wasm heap, typically created by {@linkcode runPCA}.
 * @hideconstructor
 */
export class RunPCAResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * 
     * @return {Float64Array|Float64Wasmarray} Array containing the principal components for all cells.
     * This should be treated as a column-major array where the rows are the PCs and columns are the cells.
     */
    principalComponents({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.pcs(), copy);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * 
     * @return {Float64Array|Float64WasmArray} Array containing the variance explained for each requested PC.
     */
    varianceExplained({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.variance_explained(), copy);
    }

    /**
     * @return {number} The total variance in the dataset,
     * typically used with {@linkcode PCAResults#varianceExplained varianceExplained} to compute the proportion of variance explained.
     */
    totalVariance () {
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
        // TODO: switch to this.#results.num_cells();
        return this.principalComponents({ copy: false }).length / this.numberOfPCs();

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
 * @param {object} [options] - Optional parameters. 
 * @param {?(Uint8WasmArray|Array|TypedArray)} [options.features=null] - Array specifying which features should be retained (e.g., HVGs).
 * This should be of length equal to the number of rows in `x`; elements should be `true` to retain each row.
 * If `null`, all features are retained.
 * @param {number} [options.numberOfPCs=25] - Number of top principal components to compute.
 * @param {boolean} [options.scale=false] - Whether to scale each feature to unit variance.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {string} [options.blockMethod="regress"] - How to modify the PCA for the blocking factor.
 * The default `"regress"` will regress out the factor, effectively performing a PCA on the residuals.
 * Alternatively, `"weight"` will weight the contribution of each blocking level equally so that larger blocks do not dominate the PCA.
 *
 * This option is only used if `block` is not `null`.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {RunPCAResults} Object containing the computed PCs.
 */
export function runPCA(x, { features = null, numberOfPCs = 25, scale = false, block = null, blockMethod = "regress", numberOfThreads = null } = {}) {
    var feat_data;
    var block_data;
    var output;

    utils.matchOptions("blockMethod", blockMethod, ["none", "regress", "weight", "block"]);
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

        // Avoid asking for more PCs than is possible.
        // Remember that centering removes one df, so we subtract 1 from the dimensions.
        numberOfPCs = Math.min(numberOfPCs, x.numberOfRows() - 1, x.numberOfColumns() - 1);

        if (block === null || blockMethod == 'none') {
            output = gc.call(
                module => module.run_pca(x.matrix, numberOfPCs, use_feat, fptr, scale, nthreads),
                RunPCAResults
            );

        } else {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != x.numberOfColumns()) {
                throw new Error("length of 'block' should be equal to the number of columns in 'x'");
            }
            if (blockMethod == "regress" || blockMethod == "block") { // latter for back-compatibility.
                output = gc.call(
                    module => module.run_blocked_pca(x.matrix, numberOfPCs, use_feat, fptr, scale, block_data.offset, nthreads),
                    RunPCAResults
                );
            } else if (blockMethod == "weight") {
                output = gc.call(
                    module => module.run_multibatch_pca(x.matrix, numberOfPCs, use_feat, fptr, scale, block_data.offset, nthreads),
                    RunPCAResults
                );
            } else {
                throw new Error("unknown value '" + blockMethod + "' for 'blockMethod='");
            }
        }

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(feat_data);
        utils.free(block_data);
    }

    return output;
}
