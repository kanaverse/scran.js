import * as utils from "./utils.js";
import * as gc from "./gc.js";
import { FindNearestNeighborsResults, findNearestNeighbors } from "./findNearestNeighbors.js";

/**
 * Wrapper around the SNN graph object on the Wasm heap, produced by {@linkcode buildSNNGraph}.
 * @hideconstructor
 */
export class BuildSNNGraphResults {
    #id;
    #graph;

    constructor(id, raw) {
        this.#id = id;
        this.#graph = raw;
        return;
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#graph !== null) {
            gc.release(this.#id);
            this.#graph = null;
        }
        return;
    }

    // Not documented, internal use only.
    get graph() {
        return this.#graph;
    }
}

/**
 * Build a shared nearest graph.
 *
 * @param {(BuildNeighborSearchIndexResults|FindNearestNeighborsResults)} x 
 * Either a pre-built neighbor search index for the dataset (see {@linkcode buildNeighborSearchIndex}),
 * or a pre-computed set of neighbor search results for all cells (see {@linkcode findNearestNeighbors}).
 * @param {object} [options] - Optional parameters.
 * @param {number} [options.scheme="rank"] - Weighting scheme for the edges between cells.
 * This can be based on the top ranks of the shared neighbors (`"rank"`),
 * the number of shared neighbors (`"number"`) 
 * or the Jaccard index of the neighbor sets between cells (`"jaccard"`).
 * @param {number} [options.neighbors=10] - Number of nearest neighbors to use to construct the graph.
 * Ignored if `x` is a {@linkplain FindNearestNeighborsResults} object.
 *
 * @return {BuildSNNGraphResults} Object containing the graph.
 */
export function buildSNNGraph(x, { scheme = "rank", neighbors = 10 } = {}) {
    var output;
    var my_neighbors;

    // Back compatibility.
    if (typeof scheme == "number") {
        scheme = [ "rank", "number", "jaccard" ][scheme];
    }

    try {
        let ref;
        if (x instanceof FindNearestNeighborsResults) {
            ref = x;
        } else {
            my_neighbors = findNearestNeighbors(x, neighbors); 
            ref = my_neighbors ; // separate assignment is necessary for only 'my_neighbors' but not 'x' to be freed.
        }

        output = gc.call(
            module => module.build_snn_graph(ref.results, scheme),
            BuildSNNGraphResults
        );

    } catch(e) {
        utils.free(output);
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
export class ClusterSNNGraphMultiLevelResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @return {number} The clustering level with the highest modularity.
     */
    best() {
        return this.#results.best();
    }

    /**
     * @return {number} Number of levels in the results.
     */
    numberOfLevels() {
        return this.#results.number();
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the modularity.
     * Defaults to the best clustering level from {@linkcode ClusterSNNGraphMultiLevelResults#best best}.
     *
     * @return {number} The modularity at the specified level.
     */
    modularity({ level = null } = {}) {
        if (level === null) {
            level = this.best();
        }
        return this.#results.modularity(level);
    }

    /**
     * @param {object} [options] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the cluster membership.
     * Defaults to the best clustering level from {@linkcode ClusterSNNGraphMultiLevelResults#best best}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership({ level = null, copy = true } = {}) {
        if (level === null) {
            level = this.best();
        }
        return utils.possibleCopy(this.#results.membership(level), copy);
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
 * Wrapper around the SNN walktrap clustering results on the Wasm heap, produced by {@linkcode clusterSNNGraph}.
 * @hideconstructor
 */
export class ClusterSNNGraphWalktrapResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @return {number} The maximum modularity across all merge steps.
     */
    modularity() {
        return this.#results.modularity();
    }

    /**
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.membership(), copy);
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
 * Wrapper around the SNN Leiden clustering results on the Wasm heap, produced by {@linkcode clusterSNNGraph}.
 * @hideconstructor
 */
export class ClusterSNNGraphLeidenResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @return {number} The quality of the Leiden clustering.
     *
     * Note that Leiden's quality score is technically a different measure from modularity.
     * Nonetheless, we use `modularity` for consistency with the other SNN clustering result classes.
     */
    modularity() {
        return this.#results.modularity();
    }

    /**
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.membership(), copy);
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
 * Cluster cells using community detection on the SNN graph.
 *
 * @param {BuildSNNGraphResults} x - The shared nearest neighbor graph constructed by {@linkcode buildSNNGraph}.
 * @param {object} [options] - Optional parameters.
 * @param {string} [options.method="multilevel"] - Community detection method to use.
 * This should be one of `"multilevel"`, `"walktrap"` or `"leiden"`.
 * @param {number} [options.resolution=1] - The resolution of the multi-level or Leiden clustering.
 * Larger values result in more fine-grained clusters.
 * @param {number} [options.walktrapSteps=4] - Number of steps for the Walktrap algorithm.
 *
 * @return {ClusterSNNGraphMultiLevelResults|ClusterSNNGraphWalktrapResults|ClusterSNNGraphLeidenResults} Object containing the clustering results.
 * The class of this object depends on the choice of `method`.
 */
export function clusterSNNGraph(x, { method = "multilevel", resolution = 1, walktrapSteps = 4 } = {}) {
    var output;

    try {
        if (method == "multilevel") {
            output = gc.call(
                module => module.cluster_snn_graph_multilevel(x.graph, resolution),
                ClusterSNNGraphMultiLevelResults
            );
        } else if (method == "walktrap") {
            output = gc.call(
                module => module.cluster_snn_graph_walktrap(x.graph, walktrapSteps),
                ClusterSNNGraphWalktrapResults
            );
        } else if (method == "leiden") {
            output = gc.call(
                module => module.cluster_snn_graph_leiden(x.graph, resolution),
                ClusterSNNGraphLeidenResults
            );
        } else {
            throw new Error("unknown method '" + method + "'")
        }
    } catch (e) {
        utils.free(output);
        throw e;
    }

    return output;
}
