import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { NeighborSearchResults, findNearestNeighbors } from "./findNearestNeighbors.js";

/**
 * Wrapper around the SNN graph object on the Wasm heap.
 */
export class SNNGraph {
    /**
     * @param {Object} raw Graph object allocated on the Wasm heap.
     *
     * This should not be called directly by developers,
     * call `buildSNNGraph()` instead.
     */
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
 * Either a pre-built neighbor search index for the dataset (see `buildNeighborSearchIndex()`),
 * or a pre-computed set of neighbor search results for all cells (see `findNearestNeighbors()`).
 * @param {Object} [options] - Optional parameters.
 * @param {number} [options.scheme] - Weighting scheme for the edges between cells.
 * This can be based on the top ranks of the shared neighbors (`"rank"`),
 * the number of shared neighbors (`"number"`) 
 * or the Jaccard index of the neighbor sets between cells (`"jaccard"`).
 * @param {number} [options.neighbors] - Number of nearest neighbors to use to construct the graph.
 * Ignored if `x` is a `NeighborSearchResults` object.
 *
 * @return A `SNNGraph` object containing the graph.
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
 * Wrapper around the SNN multi-level clustering results on the Wasm heap.
 */
export class SNNGraphMultiLevelClusters {
    /**
     * @param {Object} raw Results allocated on the Wasm heap.
     *
     * This should not be called directly by developers,
     * call `clusterSNNGraph()` instead.
     */
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return The clustering level with the highest modularity.
     */
    best() {
        return this.results.best();
    }

    /**
     * @return Number of levels in the results.
     */
    numberOfLevels() {
        return this.results.number();
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {?number} [options.level] - The clustering level for which to obtain the modularity.
     * Defaults to the best clustering level from `best()`.
     *
     * @return The modularity at the specified level.
     */
    modularity({ level = null } = {}) {
        if (level === null) {
            level = this.best();
        }
        return this.results.modularity(level);
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {?number} [options.level] - The clustering level for which to obtain the cluster membership.
     * Defaults to the best clustering level from `best()`.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return An `Int32Array` (or view thereof) containing the cluster membership for each cell.
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
 * Wrapper around the SNN walktrap clustering results on the Wasm heap.
 */
export class SNNGraphWalktrapClusters {
    /**
     * @param {Object} raw Results allocated on the Wasm heap.
     *
     * This should not be called directly by developers,
     * call `clusterSNNGraph()` instead.
     */
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return The maximum modularity across all merge steps.
     */
    modularity() {
        return this.results.modularity();
    }

    /**
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return {Int32Array} Array containing the cluster membership for each cell.
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
 * Wrapper around the SNN Leiden clustering results on the Wasm heap.
 */
export class SNNGraphLeidenClusters {
    /**
     * @param {Object} raw Results allocated on the Wasm heap.
     *
     * This should not be called directly by developers,
     * call `clusterSNNGraph()` instead.
     */
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return The quality of the Leiden clustering.
     *
     * Note that Leiden's quality score is technically a different measure from modularity.
     * Nonetheless, we use `modularity` for consistency with the other SNN clustering result classes.
     */
    modularity() {
        return this.results.modularity();
    }

    /**
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return {Int32Array} Array containing the cluster membership for each cell.
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
 * @param {SNNGraph} x - The shared nearest neighbor graph constructed by `buildSNNGraph()`.
 * @param {Object} [options] - Optional parameters.
 * @param {string} [options.method] - Community detection method to use.
 * This should be one of `"multilevel"`, `"walktrap"` or `"leiden"`.
 * @param {?number} [options.resolution] - The resolution of the multi-level clustering, retained for back-compatibility.
 * Overrides `multiLevelResolution` if set.
 * @param {?number} [options.multiLevelResolution] - The resolution of the multi-level clustering.
 * @param {?number} [options.leidenResolution] - The resolution of the Leiden clustering.
 * @param {number} [options.walktrapSteps] - Number of steps for the Walktrap algorithm.
 *
 * @return A `SNNGraphMultilevelClusters` object containing the clustering results.
 */
export function clusterSNNGraph(x, { method = "multilevel", resolution = null, multiLevelResolution = 1, leidenResolution = 0.05, walktrapSteps = 4 } = {}) {
    var raw;
    var output;

    try {
        if (method == "multilevel") {
            if (resolution !== null) {
                multiLevelResolution = resolution;
            }
            raw = wasm.call(module => module.cluster_snn_graph_multilevel(x.graph, multiLevelResolution));
            output = new SNNGraphMultiLevelClusters(raw);
        } else if (method == "walktrap") {
            raw = wasm.call(module => module.cluster_snn_graph_walktrap(x.graph, walktrapSteps));
            output = new SNNGraphWalktrapClusters(raw);
        } else if (method == "leiden") {
            raw = wasm.call(module => module.cluster_snn_graph_leiden(x.graph, leidenResolution));
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
