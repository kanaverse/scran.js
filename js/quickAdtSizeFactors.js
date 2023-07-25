import { clusterKmeans } from "./clusterKmeans.js";
import { logNormCounts } from "./logNormCounts.js";
import { groupedSizeFactors } from "./groupedSizeFactors.js";
import { runPca } from "./runPca.js";
import * as utils from "./utils.js";

/**
 * Quickly compute size factors for an ADT count matrix.
 * This generates k-means clusters from a matrix of PCs before calling {@linkcode groupedSizeFactors}.
 * The aim is to account for composition biases that are common in ADT-based data, while avoiding problems with per-cell sparsity.
 *
 * @param {ScranMatrix} x - An ADT count matrix.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.numberOfClusters=20] - Number of clusters to create.
 * More clusters improves the accuracy of the size factors at the cost of precision.
 * @param {number} [options.numberOfPCs=25] - Number of PCs to use.
 * More PCs captures more biological signal at the cost of increasing noise.
 * @param {?(Float64WasmArray|Array|TypedArray)} [options.totals=null] - Array containing the total count for each column in `x`, to speed up the initial normalization.
 * If `null`, this is computed from `x`.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Blocking level for each column in `x`, see {@linkcode logNormCounts} and {@linkcode runPca}.
 * For PCA, this is used to equalize the contribution of blocks of differing size.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output size factors.
 * Length should be equal to the number of columns in `x`.
 * If `null`, an array is allocated by the function.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 * 
 * @return {Float64WasmArray} Per-cell size factors for each column of `x`.
 *
 * If `buffer` is supplied, it is directly used as the return value.
 */
export function quickAdtSizeFactors(x, { numberOfClusters = 20, numberOfPCs = 25, totals = null, block = null, buffer = null, numberOfThreads = null } = {}) {
    let norm, pcs;
    try {
        norm = logNormCounts(x, { sizeFactors: totals, block: block });
        pcs = runPca(norm, { numberOfPCs: Math.min(norm.numberOfRows() - 1, numberOfPCs), numberOfThreads: numberOfThreads, block: block, blockMethod: "project" });
    } finally {
        utils.free(norm);
    }

    let clust;
    try {
        clust = clusterKmeans(pcs, numberOfClusters, { numberOfThreads: numberOfThreads });
    } finally {
        utils.free(pcs);
    }

    let local_buffer;
    try {
        if (buffer === null) {
            local_buffer = utils.createFloat64WasmArray(x.numberOfColumns());
            buffer = local_buffer;
        } else if (buffer.length !== x.numberOfColumns()) {
            throw new Error("length of 'buffer' should be equal to the number of columns in 'x'");
        }
        groupedSizeFactors(x, clust.clusters({ copy: "view" }), { buffer: buffer, allowZeros: true, allowNonFinite: true, numberOfThreads: numberOfThreads });

    } catch (e) {
        utils.free(local_buffer);
        throw e;

    } finally {
        utils.free(clust);
    }

    return buffer;
}
