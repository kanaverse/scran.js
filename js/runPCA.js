import * as wasm from "./wasm.js";
import * as utils from "./utils.js";

/** 
 * Wrapper for the PCA results on the Wasm heap.
 */
export class PCAResults {
    /**
     * @param {Object} raw Raw results allocated on the Wasm heap.
     *
     * This should not be called directly by developers.
     * Instead, `PCAResults` objects should be created by calling `runPCA()`.
     */
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     * 
     * @return A `Float64Array` (or view thereof) containing the principal components for all cells.
     * This should be treated as a column-major array where the rows are the PCs and columns are the cells.
     */
    principalComponents({ copy = true } = {}) {
        return utils.possibleCopy(this.results.pcs(), copy);
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     * 
     * @return A `Float64Array` (or view thereof) containing the variance explained for each requested PC.
     */
    varianceExplained({ copy = true } = {}) {
        return utils.possibleCopy(this.results.variance_explained(), copy);
    }

    /**
     * @return The total variance in the dataset,
     * typically used with `varianceExplained()` to compute the proportion of variance explained.
     */
    totalVariance () {
        return this.results.total_variance();
    }

    /**
     * @return Number of PCs available in these results.
     */
    numberOfPCs() {
        return this.results.num_pcs();
    }

    /**
     * @return Number of cells used to compute these results.
     */
    numberOfCells() {
        // TODO: switch to this.results.num_cells();
        return this.principalComponents({ copy: false }).length / this.numberOfPCs();

    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.results !== null) {
            this.results.delete();
            this.results = null;
        }
        return;
    }
}

/**
 * Run a principal components analysis, possibly on a subset of features.
 *
 * @param {SparseMatrix} x - The log-normalized expression matrix.
 * @param {Object} [options] - Optional parameters. 
 * @param {?(Uint8WasmArray|Array|TypedArray)} [options.features] - Array specifying which features should be retained (e.g., HVGs).
 * This should be of length equal to the number of rows in `x`; elements should be `true` to retain each row.
 * If `null`, all features are retained.
 * @param {number} [options.numberOfPCs] - Number of top principal components to compute.
 * @param {boolean} [options.scale] - Whether to scale each feature to unit variance.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to compute filters within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {string} [blockMethod] - How to modify the PCA for the blocking factor.
 * The default `"block"` will block on the factor, effectively performing a PCA on the residuals.
 * Alternatively, `"weight"` will weight the contribution of each blocking level equally so that larger blocks do not dominate the PCA.
 *
 * @return A `PCAResults` object containing the computed PCs.
 */
export function runPCA(x, { features = null, numberOfPCs = 25, scale = false, block = null, blockMethod = "block" } = {}) {
    var feat_data;
    var block_data;
    var raw;
    var output;

    try {
        var use_feat = false;
        var fptr = 0;

        if (features !== null) {
            feat_data = utils.wasmifyArray(features, "Uint8WasmArray");
            if (feat_data.length != x.numberOfRows()) {
                throw "length of 'features' should be equal to number of rows in 'x'";
            }
            use_feat = true;
            fptr = feat_data.offset;
        }

        if (block === null) {
            raw = wasm.call(module => module.run_pca(x.matrix, numberOfPCs, use_feat, fptr, scale));
        } else {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != x.numberOfColumns()) {
                throw "length of 'block' should be equal to the number of columns in 'x'";
            }
            if (blockMethod == "block") {
                raw = wasm.call(module => module.run_blocked_pca(x.matrix, numberOfPCs, use_feat, fptr, scale, block.offset));
            } else {
                raw = wasm.call(module => module.run_multibatch_pca(x.matrix, numberOfPCs, use_feat, fptr, scale, block.offset));
            }
        }
        output = new PCAResults(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(feat_data);
        utils.free(block_data);
    }

    return output;
}
