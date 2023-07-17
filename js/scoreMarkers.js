import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js";

function checkFillness2(group, summary, fillable, copy, fillcheck, getfun) {
    return utils.checkFillness(
        fillable, 
        copy, 
        fillcheck.filled || fillcheck.details[group][summary] || false, 
        () => { fillcheck.details[group][summary] = true }, 
        getfun  
    );
}

function intifySummary(summary) {
    if (typeof summary == "number") {
        return summary; // for back-compatibility with numeric summaries.
    }
    let output;
    switch (summary) {
        case "minimum": 
            output = 0;
            break;
        case "mean": 
            output = 1;
            break;
        case "median":
            output = 2;
            break;
        case "maximum": 
            output = 3;
            break;
        case "min-rank":
            output = 4;
            break;
        default:
            throw new Error("unknown summary type '" + summary + "'");
    }
    return output;
}

/**
 * Wrapper around the marker scoring results on the Wasm heap, typically produced by {@linkcode scoreMarkers}.
 * @hideconstructor
 */
export class ScoreMarkersResults {
    #id;
    #results;

    #filledMeans;
    #filledDetected;
    #filledCohen;
    #filledLfc;
    #filledAuc;
    #filledDeltaDetected;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;

        let n = this.numberOfGroups();
        let b = this.numberOfBlocks();

        function createBlockedStatsFilled(filled) {
            let output = { filled };
            if (!filled) {
                output.details = new Array(n);
                for (var g = 0; g < n; g++) {
                    output.details[g] = utils.spawnArray(b + 1, filled);
                }
            }
            return output;
        }

        this.#filledMeans = createBlockedStatsFilled(filled);
        this.#filledDetected = createBlockedStatsFilled(filled);

        function createEffectsFilled(filled) {
            let output = { filled };
            if (!filled) {
                output.details = new Array(n);
                for (var g = 0; g < n; g++) {
                    output.details[g] = {};
                }
            }
            return output;
        }

        this.#filledCohen = createEffectsFilled(filled); 
        this.#filledLfc = createEffectsFilled(filled); 
        this.#filledAuc = createEffectsFilled(filled); 
        this.#filledDeltaDetected = createEffectsFilled(filled); 

        return;
    }

    #extractBlockedStat(group, block, copy, fillable, fillcheck, method) {
        let index = block;
        if (block == null) {
            let nblocks = this.numberOfBlocks();
            index = (nblocks > 1 ? nblocks : 0);
            block = -1;
        }

        return utils.checkFillness(
            fillable, 
            copy, 
            fillcheck.filled || fillcheck.details[group][index] || false, 
            () => { fillcheck.details[group][index] = true }, 
            COPY => utils.possibleCopy(this.#results[method](group, block), COPY)
        );
    }

    /**
     * @return {number} Number of blocks used to compute the results.
     */
    numberOfBlocks() {
        return this.#results.num_blocks();
    }

    /**
     * @return {number} Number of groups in the results.
     */
    numberOfGroups() {
        return this.#results.num_groups();
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
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
     * containing the mean expression for the requested group in the requested block.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    means(group, { block = null, copy = true, fillable = false } = {}) {
        return this.#extractBlockedStat(group, block, copy, fillable, this.#filledMeans, "means");
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
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
     * containing the proportion of cells with detectable expression for the requested group in the requested block.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    detected(group, { block = null, copy = true, fillable = false } = {}) {
        return this.#extractBlockedStat(group, block, copy, fillable, this.#filledDetected, "detected");
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the Cohen's d values of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array of length equal to the number of genes,
     * containing the summarized Cohen's d for the comparisons between `group` and all other groups.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    cohen(group, { summary = "mean", copy = true, fillable = false } = {}) {
        summary = intifySummary(summary);
        return checkFillness2(
            group, 
            summary, 
            fillable, 
            copy, 
            this.#filledCohen,
            COPY => utils.possibleCopy(
                wasm.call(_ => this.#results.cohen(group, summary)),
                COPY
            )
        );
    }

    /**
     * AUCs are only computed if `computeAuc = true` in {@linkcode scoreMarkers}.
     * If `false`, this method will throw an error.
     *
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the AUCs of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array of length equal to the number of genes,
     * containing the summarized AUC for the comparisons between `group` and all other groups.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    auc(group, { summary = "mean", copy = true, fillable = false } = {}) {
        summary = intifySummary(summary);
        return checkFillness2(
            group, 
            summary, 
            fillable, 
            copy, 
            this.#filledAuc, 
            COPY => utils.possibleCopy(
                wasm.call(_ => this.#results.auc(group, summary)),
                COPY
            )
        );
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the log-fold changes of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array of length equal to the number of genes,
     * containing the summarized log-fold change for the comparisons between `group` and all other groups.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    lfc(group, { summary = "mean", copy = true, fillable = false } = {}) {
        summary = intifySummary(summary);
        return checkFillness2(
            group, 
            summary, 
            fillable, 
            copy, 
            this.#filledLfc, 
            COPY => utils.possibleCopy(
                wasm.call(_ => this.#results.lfc(group, summary)),
                COPY
            )
        );
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the delta-detected values of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized delta-detected for the comparisons between `group` and all other groups.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    deltaDetected(group, { summary = "mean", copy = true, fillable = false } = {}) {
        summary = intifySummary(summary);
        return checkFillness2(
            group, 
            summary, 
            fillable, 
            copy, 
            this.#filledDeltaDetected, 
            COPY => utils.possibleCopy(
                wasm.call(_ => this.#results.delta_detected(group, summary)),
                COPY
            )
        );
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
 * Score genes as potential markers for each group of cells.
 *
 * @param {ScranMatrix} x - Log-normalized expression matrix.
 * @param {(Int32WasmArray|Array|TypedArray)} groups - Array containing the group assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of groups.
 * @param {object} [options={}] - Optional parameters.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to perform comparisons within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 * @param {number} [options.lfcThreshold=0] - Log-fold change threshold to use for computing Cohen's d and AUC.
 * Large positive values favor markers with large log-fold changes over those with low variance.
 * @param {boolean} [options.computeAuc=true] - Whether to compute the AUCs as an effect size.
 * This can be set to `false` for greater speed and memory efficiency.
 * @param {boolean} [options.computeMedian=false] - Whether to compute the median effect sizes across all pairwise comparisons for each group.
 * This can be used as a more robust/less sensitive alternative to the mean.
 * @param {boolean} [options.computeMaximum=false] - Whether to compute the maximum effect size across all pairwise comparisons for each group.
 * This could be used to find uniquely downregulated genes.
 *
 * @return {ScoreMarkersResults} Object containing the marker scoring results.
 */
export function scoreMarkers(x, groups, { block = null, numberOfThreads = null, lfcThreshold = 0, computeAuc = true, computeMedian = false, computeMaximum = false } = {}) {
    var output;
    var block_data;
    var group_data;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        group_data = utils.wasmifyArray(groups, "Int32WasmArray");
        if (group_data.length != x.numberOfColumns()) {
            throw new Error("length of 'groups' should be equal to number of columns in 'x'");
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
            module => module.score_markers(x.matrix, group_data.offset, use_blocks, bptr, lfcThreshold, computeAuc, computeMedian, computeMaximum, nthreads),
            ScoreMarkersResults
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(block_data);
        utils.free(group_data);
    }

    return output;
}

/**
 * Create an empty {@linkplain ScoreMarkersResults} object, to be filled with custom results.
 * Note that filling requires use of `fillable: true` in the various getters to obtain a writeable memory view.
 *
 * @param {number} numberOfGenes - Number of genes in the dataset.
 * @param {number} numberOfGroups - Number of groups for which to store marker detection statistics.
 * @param {number} numberOfBlocks - Number of blocks in the dataset.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.computeAuc=true] - Whether to allocate memory for storing AUCs.
 * @param {boolean} [options.computeMedian=false] - Whether to allocate memory for storing median effect sizes.
 * @param {boolean} [options.computeMaximum=false] - Whether to allocate memory for storing maximum effect sizes.
 *
 * @return {ScoreMarkersResults} Object with memory allocated to store marker statistics, but not containing any actual values.
 */
export function emptyScoreMarkersResults(numberOfGenes, numberOfGroups, numberOfBlocks, { computeAuc = true, computeMedian = false, computeMaximum = false } = {}) {
    return gc.call(
        module => new module.ScoreMarkers_Results(numberOfGenes, numberOfGroups, numberOfBlocks, computeAuc, computeMedian, computeMaximum),
        ScoreMarkersResults,
        /* filled = */ false
    );
}
