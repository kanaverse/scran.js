import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js";

/**
 * Wrapper around the marker scoring results on the Wasm heap, typically produced by {@linkcode scoreMarkers}.
 * @hideconstructor
 */
export class ScoreMarkersResults {
    #id;
    #results;
    #has_median;
    #has_max;

    constructor(id, raw, has_median, has_max) {
        this.#id = id;
        this.#results = raw;
        this.#has_median = has_median;
        this.#has_max = has_max;
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
    mean(group, options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.mean(group), copy);
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
    detected(group, options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.detected(group), copy);
    }

    #check_forbidden(summary) {
        if ((summary == "maximum" && !(this.#has_max)) || (summary == "median" && !(this.#has_median))) {
            throw new Error("summary type '" + summary + "' not available");
        }
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the Cohen's d values of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * If the relevant options are set in {@linkcode scoreMarkers}, `"maximum"` and `"median"` are also supported.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized Cohen's d for the comparisons between `group` and all other groups.
     */
    cohensD(group, options = {}) {
        const { summary = "mean", copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        this.#check_forbidden(summary);
        return utils.possibleCopy(wasm.call(_ => this.#results.cohens_d(group, summary)), copy);
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
     * If the relevant options are set in {@linkcode scoreMarkers}, `"maximum"` and `"median"` are also supported.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized AUC for the comparisons between `group` and all other groups.
     */
    auc(group, options = {}) {
        const { summary = "mean", copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        this.#check_forbidden(summary);
        return utils.possibleCopy(wasm.call(_ => this.#results.auc(group, summary)), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the log-fold changes of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * If the relevant options are set in {@linkcode scoreMarkers}, `"maximum"` and `"median"` are also supported.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized delta-mean for the comparisons between `group` and all other groups.
     * This can be interpreted as the log-fold change if log-expression values are used in {@linkcode scoreMarkers}.
     */
    deltaMean(group, options = {}) {
        const { summary = "mean", copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        this.#check_forbidden(summary);
        return utils.possibleCopy(wasm.call(_ => this.#results.delta_mean(group, summary)), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.summary="mean"] - Summary statistic to be computed from the delta-detected values of all pairwise comparisons involving `group`.
     * This can be the `"minimum"` across comparisons, `"mean"` or `"min-rank"`.
     * If the relevant options are set in {@linkcode scoreMarkers}, `"maximum"` and `"median"` are also supported.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized delta-detected for the comparisons between `group` and all other groups.
     */
    deltaDetected(group, options = {}) {
        const { summary = "mean", copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        this.#check_forbidden(summary);
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
 * @param {number} [options.threshold=0] - Threshold on the magnitude of differences between groups, used when computing Cohen's d and AUC.
 * Large positive values favor markers with large differences over those with low variance.
 * For log-expression values in `x`, this can be interpreted as a minimum log-fold change.
 * @param {boolean} [options.computeAuc=true] - Whether to compute the AUCs as an effect size.
 * This can be set to `false` for greater speed and memory efficiency.
 * @param {boolean} [options.computeMedian=false] - Whether to compute the median effect sizes across all pairwise comparisons for each group.
 * This can be used as a more robust/less sensitive alternative to the mean.
 * @param {boolean} [options.computeMaximum=false] - Whether to compute the maximum effect size across all pairwise comparisons for each group.
 * This could be used to find uniquely downregulated genes.
 *
 * @return {ScoreMarkersResults} Object containing the marker scoring results.
 */
export function scoreMarkers(x, groups, options = {}) {
    const { block = null, threshold = 0, computeAuc = true, computeMedian = false, computeMaximum = false , numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);

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
            module => module.score_markers(x.matrix, group_data.offset, use_blocks, bptr, threshold, computeAuc, computeMedian, computeMaximum, nthreads),
            ScoreMarkersResults,
            computeMedian,
            computeMaximum
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
