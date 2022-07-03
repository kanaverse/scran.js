import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { NeighborSearchResults, findNearestNeighbors } from "./findNearestNeighbors.js";

/**
 * Wrapper around the SNN graph object on the Wasm heap, produced by {@linkcode buildSNNGraph}.
 * @hideconstructor
 */
export class SNNGraph {
    constructor(raw) {
        this.graph = raw;
        return;
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.graph !== null) {
            this.graph.delete();
            this.graph = null;
        }
        return;
    }
}

/**
 * Build a shared nearest graph.
 *
 * @param {(NeighborSearchIndex|NeighborSearchResults)} x 
 * Either a pre-built neighbor search index for the dataset (see {@linkcode buildNeighborSearchIndex}),
 * or a pre-computed set of neighbor search results for all cells (see {@linkcode findNearestNeighbors}).
 * @param {object} [options] - Optional parameters.
 * @param {number} [options.scheme="rank"] - Weighting scheme for the edges between cells.
 * This can be based on the top ranks of the shared neighbors (`"rank"`),
 * the number of shared neighbors (`"number"`) 
 * or the Jaccard index of the neighbor sets between cells (`"jaccard"`).
 * @param {number} [options.neighbors=10] - Number of nearest neighbors to use to construct the graph.
 * Ignored if `x` is a {@linkplain NeighborSearchResults} object.
 *
 * @return {SNNGraph} Object containing the graph.
 */
export function buildSNNGraph(x, { scheme = "rank", neighbors = 10 } = {}) {
    var raw;
    var output;
    var my_neighbors;

    // Back compatibility.
    if (typeof scheme == "number") {
        scheme = [ "rank", "number", "jaccard" ][scheme];
    }

    try {
        let ref;
        if (x instanceof NeighborSearchResults) {
            ref = x;
        } else {
            my_neighbors = findNearestNeighbors(x, neighbors); 
            ref = my_neighbors ; // separate assignment is necessary for only 'my_neighbors' but not 'x' to be freed.
        }

        raw = wasm.call(module => module.build_snn_graph(ref.results, scheme));
        output = new SNNGraph(raw);

    } catch(e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(my_neighbors);
    }

    return output;
}

/**
 * Wrapper around the SNN multi-level clustering results on the Wasm heap, produced by {@linkcode clusterSNNGraph}.
 * @hideconstructor
 */
export class SNNGraphMultiLevelClusters {
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return {number} The clustering level with the highest modularity.
     */
    best() {
        return this.results.best();
    }

    /**
     * @return {number} Number of levels in the results.
     */
    numberOfLevels() {
        return this.results.number();
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the modularity.
     * Defaults to the best clustering level from {@linkcode SNNGraphMultiLevelClusters#best best}.
     *
     * @return {number} The modularity at the specified level.
     */
    modularity({ level = null } = {}) {
        if (level === null) {
            level = this.best();
        }
        return this.results.modularity(level);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the cluster membership.
     * Defaults to the best clustering level from {@linkcode SNNGraphMultiLevelClusters#best best}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership({ level = null, copy = true } = {}) {
        if (level === null) {
            level = this.best();
        }
        return utils.possibleCopy(this.results.membership(level), copy);
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
 * Wrapper around the SNN walktrap clustering results on the Wasm heap, produced by {@linkcode clusterSNNGraph}.
 * @hideconstructor
 */
export class SNNGraphWalktrapClusters {
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return {number} The maximum modularity across all merge steps.
     */
    modularity() {
        return this.results.modularity();
    }

    /**
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership({ copy = true } = {}) {
        return utils.possibleCopy(this.results.membership(), copy);
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
 * Wrapper around the SNN Leiden clustering results on the Wasm heap, produced by {@linkcode clusterSNNGraph}.
 * @hideconstructor
 */
export class SNNGraphLeidenClusters {
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return {number} The quality of the Leiden clustering.
     *
     * Note that Leiden's quality score is technically a different measure from modularity.
     * Nonetheless, we use `modularity` for consistency with the other SNN clustering result classes.
     */
    modularity() {
        return this.results.modularity();
    }

    /**
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership({ copy = true } = {}) {
        return utils.possibleCopy(this.results.membership(), copy);
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
 * Cluster cells using community detection on the SNN graph.
 *
 * @param {SNNGraph} x - The shared nearest neighbor graph constructed by {@linkcode buildSNNGraph}.
 * @param {object} [options] - Optional parameters.
 * @param {string} [options.method="multilevel"] - Community detection method to use.
 * This should be one of `"multilevel"`, `"walktrap"` or `"leiden"`.
 * @param {number} [options.resolution=1] - The resolution of the multi-level or Leiden clustering.
 * Larger values result in more fine-grained clusters.
 * @param {number} [options.walktrapSteps=4] - Number of steps for the Walktrap algorithm.
 *
 * @return {SNNGraphMultiLevelClusters|SNNGraphWalktrapClusters|SNNGraphLeidenClusters} Object containing the clustering results.
 * The class of this object depends on the choice of `method`.
 */
export function clusterSNNGraph(x, { method = "multilevel", resolution = 1, walktrapSteps = 4 } = {}) {
    var raw;
    var output;

    try {
        if (method == "multilevel") {
            raw = wasm.call(module => module.cluster_snn_graph_multilevel(x.graph, resolution));
            output = new SNNGraphMultiLevelClusters(raw);
        } else if (method == "walktrap") {
            raw = wasm.call(module => module.cluster_snn_graph_walktrap(x.graph, walktrapSteps));
            output = new SNNGraphWalktrapClusters(raw);
        } else if (method == "leiden") {
            raw = wasm.call(module => module.cluster_snn_graph_leiden(x.graph, resolution));
            output = new SNNGraphLeidenClusters(raw);
        } else {
            throw new Error("unknown method '" + method + "'")
        }
    } catch (e) {
        utils.free(raw);
        throw e;
    }

    return output;
}
