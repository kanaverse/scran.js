import * as wasm from "./wasm.js";
import * as utils from "./utils.js";

/**
 * Wrapper around the marker scoring results on the Wasm heap, typically produced by {@linkcode scoreMarkers}.
 * @hideconstructor
 */
export class ScoreMarkersResults {
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return {number} Number of blocks used to compute the results.
     */
    numberOfBlocks() {
        return this.results.num_blocks();
    }

    /**
     * @return {number} Number of groups in the results.
     */
    numberOfGroups() {
        return this.results.num_groups();
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.block=-1] - Number of the block for which to extract statistics.
     * If negative, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVarResults#numberOfBlocks numberOfBlocks}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the mean expression for the requested group in the requested block.
     */
    means(group, { block = -1, copy = true } = {}) {
        return utils.possibleCopy(this.results.means(group, block), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.block=-1] - Number of the block for which to extract statistics.
     * If negative, the average across all blocks is returned.
     * Otherwise, should be less than the value returned by {@linkcode ModelGeneVarResults#numberOfBlocks numberOfBlocks}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the proportion of cells with detectable expression for the requested group in the requested block.
     */
    detected(group, { block = -1, copy = true } = {}) {
        return utils.possibleCopy(this.results.detected(group, block), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.summary=1] - Summary statistic to be computed from the Cohen's d values of all pairwise comparisons involving `group`.
     * This can be the minimum across comparisons (0), mean (1) or min-rank (4).
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized Cohen's d for the comparisons between `group` and all other groups.
     */
    cohen(group, { summary = 1, copy = true } = {}) {
        return utils.possibleCopy(this.results.cohen(group, summary), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.summary=1] - Summary statistic to be computed from the AUCs of all pairwise comparisons involving `group`.
     * This can be the minimum across comparisons (0), mean (1) or min-rank (4).
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized AUC for the comparisons between `group` and all other groups.
     */
    auc(group, { summary = 1, copy = true } = {}) {
        return utils.possibleCopy(this.results.auc(group, summary), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.summary=1] - Summary statistic to be computed from the log-fold changes of all pairwise comparisons involving `group`.
     * This can be the minimum across comparisons (0), mean (1) or min-rank (4).
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized log-fold change for the comparisons between `group` and all other groups.
     */
    lfc(group, { summary = 1, copy = true } = {}) {
        return utils.possibleCopy(this.results.lfc(group, summary), copy);
    }

    /**
     * @param {number} group - Group of interest.
     * Should be non-negative and less than {@linkcode ScoreMarkersResults#numberOfGroups numberOfGroups}.
     * @param {object} [options] - Optional parameters.
     * @param {number} [options.summary] - Summary statistic to be computed from the delta-detected values of all pairwise comparisons involving `group`.
     * This can be the minimum across comparisons (0), mean (1) or min-rank (4).
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes,
     * containing the summarized delta-detected for the comparisons between `group` and all other groups.
     */
    deltaDetected(group, { summary = 1, copy = true } = {}) {
        return utils.possibleCopy(this.results.delta_detected(group, summary), copy);
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
 * Score genes as potential markers for each group of cells.
 *
 * @param {ScranMatrix} x - Log-normalized expression matrix.
 * @param {(Int32WasmArray|Array|TypedArray)} groups - Array containing the group assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of groups.
 * @param {object} [options] - Optional parameters.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to perform comparisons within each block.
 * Alternatively, this may be `null`, in which case all cells are assumed to be in the same block.
 *
 * @return {ScoreMarkersResults} Object containing the marker scoring results.
 */
export function scoreMarkers(x, groups, { block = null } = {}) {
    var raw;
    var output;
    var block_data;
    var group_data;

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

        raw = wasm.call(module => module.score_markers(x.matrix, group_data.offset, use_blocks, bptr));
        output = new ScoreMarkersResults(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(block_data);
        utils.free(group_data);
    }

    return output;
}
