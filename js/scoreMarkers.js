import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js";

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

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;
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
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array of length equal to the number of genes,
     * containing the mean expression for the requested group in the requested block.
     */
    means(group, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.means(group), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the proportion of cells with detectable expression for the requested group in the requested block.
     */
    detected(group, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.detected(group), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the Cohen's d values of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized Cohen's d for the comparisons between `group` and all other groups.
     */
    cohen(group, { summary = "mean", copy = true } = {}) {
        summary = intifySummary(summary);
        return utils.possibleCopy(wasm.call(_ => this.#results.cohen(group, summary)), copy);
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
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized AUC for the comparisons between `group` and all other groups.
     */
    auc(group, { summary = "mean", copy = true } = {}) {
        summary = intifySummary(summary)
        return utils.possibleCopy(wasm.call(_ => this.#results.auc(group, summary)), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the log-fold changes of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized log-fold change for the comparisons between `group` and all other groups.
     */
    lfc(group, { summary = "mean", copy = true } = {}) {
        summary = intifySummary(summary);
        return utils.possibleCopy(wasm.call(_ => this.#results.lfc(group, summary)), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the delta-detected values of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized delta-detected for the comparisons between `group` and all other groups.
     */
    deltaDetected(group, { summary = "mean", copy = true } = {}) {
        summary = intifySummary(summary);
        return utils.possibleCopy(wasm.call(_ => this.#results.delta_detected(group, summary)), copy);
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
