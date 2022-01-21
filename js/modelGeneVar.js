import * as wasm from "./wasm.js";
import * as utils from "./utils.js";

/**
 * Wrapper for the variance modelling results.
 */
export class ModelGeneVarResults {
    /**
     * @param {Object} raw Raw results on the Wasm heap.
     *
     * This should not be called directly, but rather, instances should be created with `modelGeneVar()`.
     */
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {number} [options.block] - Block number.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) of length equal to the number of genes,
     * containing the mean log-expression across all cells in the specified `block`. 
     */
    means({ block = 0, copy = true } = {}) {
        var output = this.results.means(block);
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {number} [options.block] - Block number.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) of length equal to the number of genes,
     * containing the variance of log-expression across all cells in the specified `block`. 
     */
    variances({ block = 0, copy = true } = {}) {
        var output = this.results.variances(block);
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {number} [options.block] - Block number.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) of length equal to the number of genes,
     * containing the fitted value of the mean-variance trend for the specified `block`. 
     */
    fitted({ block = 0, copy = true } = {}) {
        var output = this.results.fitted(block);
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {number} [options.block] - Block number.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) of length equal to the number of genes,
     * containing the residuals from the mean-variance trend for the specified `block`. 
     */
    residuals({ block = 0, copy = true } = {}) {
        var output = this.results.residuals(block);
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
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
 * Model the mean-variance trend across genes.
 *
 * @param {SparseMatrix} x - The normalized log-expression matrix.
 * @param {Object} [options] - Optional parameters.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to fit the mean-variance trend within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {number} [options.span] - Span to use for the LOWESS trend fitting.
 *
 * @return A `ModelGeneVarResults` object containing the variance modelling results.
 */
export function modelGeneVar(x, { block = null, span = 0.3 } = {}) {
    var block_data;
    var raw;
    var output;

    try {
        var bptr = 0;
        var use_blocks = false;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != x.numberOfColumns()) {
                throw "'block' must be of length equal to the number of columns in 'x'";
            }
            use_blocks = true;
            bptr = block_data.offset;
        }

        raw = wasm.call(module => module.model_gene_var(x.matrix, use_blocks, bptr, span));
        output = new ModelGeneVarResults(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(block_data);
    }
    
    return output;
}
