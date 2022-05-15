import * as cluster from "./clusterKmeans.js";
import * as lognorm from "./logNormCounts.js";
import * as grouped from "./groupedSizeFactors.js";
import * as pca from "./runPCA.js";
import * as utils from "./utils.js";

/**
 * Quickly compute size factors for an ADT count matrix.
 * This generates k-means clusters from a matrix of PCs before calling {@linkcode groupedSizeFactors}.
 * The aim is to account for composition biases that are common in ADT-based data, while avoiding problems with per-cell sparsity.
 *
 * @param {ScranMatrix} x - An ADT count matrix.
 * @param {Object} [options] - Optional parameters.
 * @param {number} [options.numberOfClusters] - Number of clusters to create.
 * More clusters improves the accuracy of the size factors at the cost of precision.
 * @param {number} [options.numberOfPCs] - Number of PCs to use.
 * More PCs captures more biological signal at the cost of increasing noise.
 * @param {?(Float64WasmArray|Array|TypedArray)} [options.totals] - Total count for each column in `x`.
 * If `null`, this is computed from `x`.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block] - Blocking level for each column in `x`, see {@linkcode logNormCounts}.
 * @param {?Float64WasmArray} [options.buffer] - Buffer in which to store the output size factors.
 * Length should be equal to the number of columns in `x`.
 * If `null`, an array is allocated by the function.
 * 
 * @return {Float64WasmArray} Per-cell size factors for each column of `x`.
 * If `options.buffer` is supplied, the return value is a view on it.
 */
export function quickAdtSizeFactors(x, { numberOfClusters = 20, numberOfPCs = 25, totals = null, block = null, buffer = null } = {}) {
    let norm, pcs;
    try {
        norm = lognorm.logNormCounts(x, { sizeFactors: totals, block: block });
        pcs = pca.runPCA(norm, { numberOfPCs: Math.min(norm.numberOfRows() - 1, numberOfPCs) });
    } finally {
        utils.free(norm);
    }

    let clust;
    try {
        clust = cluster.clusterKmeans(pcs, numberOfClusters);
    } finally {
        utils.free(pcs);
    }

    let output;
    try {
        if (buffer === null) {
            output = utils.createFloat64WasmArray(x.numberOfColumns());
        } else {
            if (buffer.length !== x.numberOfColumns()) {
                throw new Error("length of 'buffer' should be equal to the number of columns in 'x'");
            }
            output = buffer.view();
        }
        grouped.groupedSizeFactors(x, clust.clusters({ copy: "view" }), { buffer: output });
    } catch (e) {
        utils.free(output);
        throw e;
    } finally {
        utils.free(clust);
    }

    return output;
}
