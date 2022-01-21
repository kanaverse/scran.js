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
        // TODO: switch to this.results.num_pcs();
        return this.varianceExplained({ copy: false }).length;
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
    free () {
        this.results.delete();
        this.results = null;
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
 *
 * @return A `PCAResults` object containing the computed PCs.
 */
export function runPCA(x, { features = null, numberOfPCs = 25, scale = false } = {}) {
    var feat_data;
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

        raw = wasm.call(module => module.run_pca(x.matrix, numberOfPCs, use_feat, fptr, scale));
        output = new PCAResults(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(feat_data);
    }

    return output;
}
