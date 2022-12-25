import * as gc from "./gc.js";
import * as utils from "./utils.js";

/**
 * Wrapper for the variance modelling results, produced by {@linkcode modelGeneVar}.
 * @hideconstructor
 */
export class ModelGeneVarResults {
    #id;
    #results;

    #filledMeans;
    #filledVariances;
    #filledFitted;
    #filledResiduals;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;

        this.#filledMeans = utils.spawnArray(this.numberOfBlocks() + 1, filled);
        this.#filledVariances = utils.spawnArray(this.numberOfBlocks() + 1, filled);
        this.#filledFitted = utils.spawnArray(this.numberOfBlocks() + 1, filled);
        this.#filledResiduals = utils.spawnArray(this.numberOfBlocks() + 1, filled);

        return;
    }

    #extract(block, copy, fillable, fillcheck, method) {
        let fillindex = block;
        if (block == null) {
            let nblocks = this.numberOfBlocks();
            fillindex = (nblocks > 1 ? nblocks : 0);
            block = -1;
        }

        return utils.checkFillness(
            fillable, 
            copy, 
            fillcheck[fillindex], 
            () => { fillcheck[fillindex] = true }, 
            COPY => utils.possibleCopy(this.#results[method](block), COPY)
        );
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.block=null] - Number of the block for which to extract statistics.
     * If `null`, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVarResults#numberOfBlocks numberOfBlocks}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array of length equal to the number of genes,
     * containing the mean log-expression across all cells in the specified `block`
     * (or the average across all blocks, if `block < 0`).
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    means({ block = null, copy = true, fillable = false } = {}) {
        return this.#extract(block, copy, fillable, this.#filledMeans, "means");
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.block=null] - Number of the block for which to extract statistics.
     * If `null`, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVarResults#numberOfBlocks numberOfBlocks}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array of length equal to the number of genes,
     * containing the variance of log-expression across all cells in the specified `block`
     * (or the average across all blocks, if `block < 0`).
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    variances({ block = null, copy = true, fillable = false } = {}) {
        return this.#extract(block, copy, fillable, this.#filledVariances, "variances");
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.block=null] - Number of the block for which to extract statistics.
     * If `null`, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVarResults#numberOfBlocks numberOfBlocks}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the fitted value of the mean-variance trend for the specified `block`
     * (or the average across all blocks, if `block < 0`).
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    fitted({ block = null, copy = true, fillable = false } = {}) {
        return this.#extract(block, copy, fillable, this.#filledFitted, "fitted");
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.block=null] - Number of the block for which to extract statistics.
     * If `null`, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVarResults#numberOfBlocks numberOfBlocks}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the residuals from the mean-variance trend for the specified `block`
     * (or the average across all blocks, if `block < 0`).
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    residuals({ block = null, copy = true, fillable = false } = {}) {
        return this.#extract(block, copy, fillable, this.#filledResiduals, "residuals");
    }

    /**
     * @return {number} Number of blocks used.
     */
    numberOfBlocks() {
        return this.#results.num_blocks();
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
 * @param {object} [options] - Optional parameters.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to fit the mean-variance trend within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {number} [options.span=0.3] - Span to use for the LOWESS trend fitting.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {ModelGeneVarResults} Object containing the variance modelling results.
 */
export function modelGeneVar(x, { block = null, span = 0.3, numberOfThreads = null } = {}) {
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
            module => module.model_gene_var(x.matrix, use_blocks, bptr, span, nthreads),
            ModelGeneVarResults
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(block_data);
    }
    
    return output;
}

/**
 * Create an empty {@linkplain ModelGeneVarResults} object, to be filled with custom results.
 * This is typically used to generate a convenient input into later {@linkcode chooseHVGs} calls.
 * Note that filling requires use of `fillable: true` in the various getters to obtain a writeable memory view.
 *
 * @param {number} numberOfGenes - Number of genes in the dataset.
 * @param {number} numberOfBlocks - Number of blocks in the dataset.
 *
 * @return {ModelGeneVarResults} Object with allocated memory to store variance modelling statistics, but no actual values.
 */
export function emptyModelGeneVarResults(numberOfGenes, numberOfBlocks) {
    return gc.call(
        module => new module.ModelGeneVar_Results(numberOfGenes, numberOfBlocks),
        ModelGeneVarResults,
        /* filled = */ false
    );
}
