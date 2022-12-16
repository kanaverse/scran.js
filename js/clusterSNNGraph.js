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
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {BuildSNNGraphResults} Object containing the graph.
 */
export function buildSNNGraph(x, { scheme = "rank", neighbors = 10, numberOfThreads = null } = {}) {
    var output;
    var my_neighbors;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    // Back compatibility.
    if (typeof scheme == "number") {
        scheme = [ "rank", "number", "jaccard" ][scheme];
    }

    try {
        let ref;
        if (x instanceof FindNearestNeighborsResults) {
            ref = x;
        } else {
            my_neighbors = findNearestNeighbors(x, neighbors, { numberOfThreads: nthreads }); 
            ref = my_neighbors ; // separate assignment is necessary for only 'my_neighbors' but not 'x' to be freed.
        }

        output = gc.call(
            module => module.build_snn_graph(ref.results, scheme, nthreads),
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
     * @param {number} best - Clustering level with the highest modularity.
     * @return `best` is set as the best clustering level.
     * This is typically only used after {@linkcode emptyClusterSNNGraphResults}.
     */
    setBest(best) {
        this.#results.set_best(best);
        return;
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
     * @param {number} level - The clustering level at which to set the modularity.
     * @param {number} modularity - Modularity value.
     *
     * @return `modularity` is set as the modularity at the specified level.
     * This is typically only used after {@linkcode emptyClusterSNNGraphResults}.
     */
    setModularity(level, modularity) {
        return this.#results.set_modularity(level, modularity);
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
     * @return {number} Number of merge steps used by the Walktrap algorithm.
     */
    numberOfMergeSteps() {
        return this.#results.num_merge_steps();
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.at=null] - Index at which to extract the modularity.
     * This can be any value from 0 to {@linkcode ClusterSNNGraphWalktrapResults#numberOfMergeSteps numberOfMergeSteps} plus 1.
     * Set to `null` to obtain the largest modularity across all merge steps.
     *
     * @return {number} The modularity at the specified merge step, or the maximum modularity across all merge steps.
     */
    modularity({ at = null } = {}) {
        if (at === null) {
            at = -1;
        }
        return this.#results.modularity(at);
    }

    /**
     * @param {number} at - Index at which to set the modularity.
     * This can be any value from 0 to {@linkcode ClusterSNNGraphWalktrapResults#numberOfMergeSteps numberOfMergeSteps} plus 1.
     * @param {number} modularity - Modularity value.
     *
     * @return Modularity value is set in this object.
     * This is typically used after calling {@linkcode emptyClusterSNNGraphResults}.
     */
    setModularity(at, modularity) {
        this.#results.set_modularity(at, modularity);
        return;
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
     * @param {number} modularity - Modularity value.
     * @return Modularity value is set in this object.
     * This is typically used after calling {@linkcode emptyClusterSNNGraphResults}.
     */
    setModularity(modularity) {
        this.#results.set_modularity(modularity);
        return;
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

/**
 * Create an empty {@linkplain ClusterSNNGraphMultiLevelResults} object (or one of its counterparts), to be filled with custom results.
 * Note that filling requires use of `copy: false` in the various getters to obtain a writeable memory view.
 *
 * @param {number} numberOfCells - Number of cells in the dataset.
 * @param {object} [options={}] - Optional parameters.
 * @param {string} [options.method="multilevel"] - Community detection method to use.
 * This should be one of `"multilevel"`, `"walktrap"` or `"leiden"`.
 * @param {number} [options.numberOfLevels=1] - Number of levels for which to allocate space when `method="multilevel"`.
 * @param {number} [options.numberOfMergeSteps=1] - Number of merge steps for which to allocate space when `method="walktrap"`.
 *
 * @return {ClusterSNNGraphMultiLevelResults|ClusterSNNGraphWalktrapResults|ClusterSNNGraphLeidenResults} 
 * Object with space allocated to store the clustering results.
 */
export function emptyClusterSNNGraphResults(numberOfCells, { method = "multilevel", numberOfLevels = 1, numberOfMergeSteps = 1 } = {}) {
    if (method == "multilevel") {
        return gc.call(
            module => new module.ClusterSNNGraphMultiLevel_Result(numberOfCells, numberOfLevels),
            ClusterSNNGraphMultiLevelResults
        );
    } else if (method == "walktrap") {
        return gc.call(
            module => new module.ClusterSNNGraphWalktrap_Result(numberOfCells, numberOfMergeSteps),
            ClusterSNNGraphWalktrapResults
        );
    } else if (method == "leiden") {
        return gc.call(
            module => new module.ClusterSNNGraphLeiden_Result(numberOfCells),
            ClusterSNNGraphLeidenResults
        );
    } else {
        throw new Error("unknown method '" + method + "'")
    }
}
