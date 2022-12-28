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
 * @param {object} [options={}] - Optional parameters.
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

    utils.matchOptions("scheme", scheme, [ "rank", "number", "jaccard" ]);

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

    #filledBest;
    #filledModularity;
    #filledMembership;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;

        this.#filledBest = filled;
        this.#filledModularity = utils.spawnArray(this.numberOfLevels(), filled);
        this.#filledMembership = utils.spawnArray(this.numberOfLevels(), filled);

        return;
    }

    /**
     * @return {?number} The clustering level with the highest modularity.
     * Alternatively `null`, if this has not been previously set via {@linkcode ClusterSNNGraphMultiLevelResults#setBest setBest}.
     */
    best() {
        if (!this.#filledBest) {
            return null;
        } else {
            return this.#results.best();
        }
    }

    #chooseLevel(level) {
        if (level === null) {
            level = this.best();
            if (level == null) {
                throw new Error("'best' has not yet been set via 'setBest'");
            }
        }
        return level;
    }

    /**
     * @param {number} best - Clustering level with the highest modularity.
     * @return `best` is set as the best clustering level.
     * This is typically only used after {@linkcode emptyClusterSNNGraphResults}.
     */
    setBest(best) {
        if (!this.#filledBest) {
            this.#filledBest = true;
        }
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
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the modularity.
     * Defaults to the best clustering level from {@linkcode ClusterSNNGraphMultiLevelResults#best best}.
     *
     * @return {?number} The modularity at the specified level.
     * Alternatively `null`, if this has not been set by {@linkcode ClusterSNNGraphMultiLevelResults#setModularity setModularity}.
     */
    modularity({ level = null } = {}) {
        level = this.#chooseLevel(level);
        if (!this.#filledModularity[level]) {
            return null;
        } else {
            return this.#results.modularity(level);
        }
    }

    /**
     * @param {number} level - The clustering level at which to set the modularity.
     * @param {number} modularity - Modularity value.
     *
     * @return `modularity` is set as the modularity at the specified level.
     * This is typically only used after {@linkcode emptyClusterSNNGraphResults}.
     */
    setModularity(level, modularity) {
        if (!this.#filledModularity[level]) {
            this.#filledModularity[level] = true;
        }
        this.#results.set_modularity(level, modularity);
        return;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the cluster membership.
     * Defaults to the best clustering level from {@linkcode ClusterSNNGraphMultiLevelResults#best best}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Int32Array|Int32WasmArray)} Array containing the cluster membership for each cell.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    membership({ level = null, copy = true, fillable = false } = {}) {
        level = this.#chooseLevel(level);
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledMembership[level], 
            () => { this.#filledMembership[level] = true; }, 
            COPY => utils.possibleCopy(this.#results.membership(level), COPY)
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
 * Wrapper around the SNN walktrap clustering results on the Wasm heap, produced by {@linkcode clusterSNNGraph}.
 * @hideconstructor
 */
export class ClusterSNNGraphWalktrapResults {
    #id;
    #results;

    #filledModularity;
    #filledModularityDetails;
    #filledMembership;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;

        this.#filledModularity = filled;
        this.#filledMembership = filled;
        if (!filled) {
            let n = this.numberOfMergeSteps() + 1;
            this.#filledModularityDetails = { which: utils.spawnArray(n, false), remaining: n };
        }

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
     * @return {?number} The modularity at the specified merge step, or the maximum modularity across all merge steps.
     * Alternatively `null`, if this has not been set by {@linkcode ClusterSNNGraphWalktrapResults#setModularity setModularity}.
     */
    modularity({ at = null } = {}) {
        let fail = false;
        if (at === null) {
            if (!this.#filledModularity) {
                return null;
            }
            at = -1;
        } else if (!this.#filledModularity && !this.#filledModularityDetails[at]) {
            return null;
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
        if (!this.#filledModularity) {
            this.#filledModularityDetails.which[at] = true;
            this.#filledModularityDetails.remaining--;
            if (this.#filledModularityDetails.remaining == 0) {
                this.#filledModularity = true;
            }
        }
        this.#results.set_modularity(at, modularity);
        return;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Int32Array|Int32WasmArray)} Array containing the cluster membership for each cell.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    membership({ copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledMembership, 
            () => { this.#filledMembership = true; }, 
            COPY => utils.possibleCopy(this.#results.membership(), COPY)
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
 * Wrapper around the SNN Leiden clustering results on the Wasm heap, produced by {@linkcode clusterSNNGraph}.
 * @hideconstructor
 */
export class ClusterSNNGraphLeidenResults {
    #id;
    #results;

    #filledModularity;
    #filledMembership;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;

        this.#filledModularity = filled;
        this.#filledMembership = filled;
        return;
    }

    /**
     * @return {?number} The quality of the Leiden clustering.
     * Alternatively `null`, if this has not been set by {@linkcode ClusterSNNGraphLeidenResults#setModularity setModularity}.
     *
     * Note that Leiden's quality score is technically a different measure from modularity.
     * Nonetheless, we use `modularity` for consistency with the other SNN clustering result classes.
     */
    modularity() {
        if (!this.#filledModularity) {
            return null;
        } else {
            return this.#results.modularity();
        }
    }

    /**
     * @param {number} modularity - Modularity value.
     * @return Modularity value is set in this object.
     * This is typically used after calling {@linkcode emptyClusterSNNGraphResults}.
     */
    setModularity(modularity) {
        if (!this.#filledModularity) {
            this.#filledModularity = true;
        }
        this.#results.set_modularity(modularity);
        return;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Int32Array|Int32WasmArray)} Array containing the cluster membership for each cell.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    membership({ copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledMembership, 
            () => { this.#filledMembership = true; }, 
            COPY => utils.possibleCopy(this.#results.membership(), COPY)
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
 * Cluster cells using community detection on the SNN graph.
 *
 * @param {BuildSNNGraphResults} x - The shared nearest neighbor graph constructed by {@linkcode buildSNNGraph}.
 * @param {object} [options={}] - Optional parameters.
 * @param {string} [options.method="multilevel"] - Community detection method to use.
 * This should be one of `"multilevel"`, `"walktrap"` or `"leiden"`.
 * @param {number} [options.multiLevelResolution=1] - The resolution of the multi-level clustering, when `method = "multilevel"`.
 * Larger values result in more fine-grained clusters.
 * @param {number} [options.leidenResolution=1] - The resolution of the Leiden clustering, when `method = "leiden"`.
 * Larger values result in more fine-grained clusters.
 * @param {boolean} [options.leidenModularityObjective=false] - Whether to use the modularity as the objective function when `method = "leiden"`.
 * By default, the Constant-Potts Model is used instead.
 * Set to `true` to get an interpretation of the resolution on par with that of `method = "multilevel"`.
 * @param {number} [options.walktrapSteps=4] - Number of steps for the Walktrap algorithm, when `method = "walktrap"`.
 *
 * @return {ClusterSNNGraphMultiLevelResults|ClusterSNNGraphWalktrapResults|ClusterSNNGraphLeidenResults} Object containing the clustering results.
 * The class of this object depends on the choice of `method`.
 */
export function clusterSNNGraph(x, { 
    method = "multilevel", 
    multiLevelResolution = 1, 
    leidenResolution = 1, 
    leidenModularityObjective = false,
    walktrapSteps = 4
} = {}) {
    var output;

    try {
        if (method == "multilevel") {
            output = gc.call(
                module => module.cluster_snn_graph_multilevel(x.graph, multiLevelResolution),
                ClusterSNNGraphMultiLevelResults
            );
        } else if (method == "walktrap") {
            output = gc.call(
                module => module.cluster_snn_graph_walktrap(x.graph, walktrapSteps),
                ClusterSNNGraphWalktrapResults
            );
        } else if (method == "leiden") {
            output = gc.call(
                module => module.cluster_snn_graph_leiden(x.graph, leidenResolution, leidenModularityObjective),
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
 * Note that filling requires use of `fillable: true` in the various getters to obtain a writeable memory view.
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
            ClusterSNNGraphMultiLevelResults,
            /* filled = */ false
        );
    } else if (method == "walktrap") {
        return gc.call(
            module => new module.ClusterSNNGraphWalktrap_Result(numberOfCells, numberOfMergeSteps),
            ClusterSNNGraphWalktrapResults,
            /* filled = */ false
        );
    } else if (method == "leiden") {
        return gc.call(
            module => new module.ClusterSNNGraphLeiden_Result(numberOfCells),
            ClusterSNNGraphLeidenResults,
            /* filled = */ false
        );
    } else {
        throw new Error("unknown method '" + method + "'")
    }
}
