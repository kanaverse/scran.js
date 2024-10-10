import * as utils from "./utils.js";
import * as gc from "./gc.js";
import { BuildSnnGraphResults } from "./buildSnnGraph.js";

/**
 * Wrapper around multi-level clustering results on the Wasm heap, produced by {@linkcode clusterGraph}.
 * @hideconstructor
 */
export class ClusterMultilevelResults {
    #id;
    #results;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;
    }

    /**
     * @return {number} Number of levels in the results.
     */
    numberOfLevels() {
        return this.#results.num_levels();
    }

    /**
     * @return {number} Level with the lowest modularity.
     */
    bestLevel() {
        return this.#results.best_level();
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the modularity.
     * Defaults to the best clustering level from {@linkcode ClusterMultilevelResults#bestLevel bestLevel}.
     *
     * @return {number} The modularity at the specified level.
     */
    modularity({ level = null } = {}) {
        if (level == null) {
            level = this.bestLevel();
        }
        return this.#results.modularity(level);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the cluster membership.
     * Defaults to the best clustering level from {@linkcode ClusterMultilevelResults#bestLevel bestLevel}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership({ level = null, copy = true } = {}) {
        if (level == null) {
            level = -1;
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
 * Wrapper around the walktrap clustering results on the Wasm heap, produced by {@linkcode clusterGraph}.
 * @hideconstructor
 */
export class ClusterWalktrapResults {
    #id;
    #results;

    constructor(id, raw, filled = true) {
        this.#id = id;
        this.#results = raw;
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
     * This can be any value from 0 to {@linkcode ClusterWalktrapResults#numberOfMergeSteps numberOfMergeSteps} plus 1.
     * Set to `null` to obtain the largest modularity across all merge steps.
     * @return {number} The modularity at the specified merge step, or the maximum modularity across all merge steps.
     */
    modularity({ at = null } = {}) {
        if (at === null) {
            at = -1;
        }
        return this.#results.modularity(at);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
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
 * Wrapper around the Leiden clustering results on the Wasm heap, produced by {@linkcode clusterGraph}.
 * @hideconstructor
 */
export class ClusterLeidenResults {
    #id;
    #results;

    constructor(id, raw, filled = true) {
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
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     *
     * @return {(Int32Array|Int32WasmArray)} Array containing the cluster membership for each cell.
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
 * @param {BuildSnnGraphResults} x - The shared nearest neighbor graph constructed by {@linkcode buildSnnGraph}.
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
 * @return {ClusterMultiLevelResults|ClusterWalktrapResults|ClusterLeidenResults} Object containing the clustering results.
 * The class of this object depends on the choice of `method`.
 */
export function clusterGraph(x, { 
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
                module => module.cluster_multilevel(x.graph, multiLevelResolution),
                ClusterMultilevelResults
            );
        } else if (method == "walktrap") {
            output = gc.call(
                module => module.cluster_walktrap(x.graph, walktrapSteps),
                ClusterWalktrapResults
            );
        } else if (method == "leiden") {
            output = gc.call(
                module => module.cluster_leiden(x.graph, leidenResolution, leidenModularityObjective),
                ClusterLeidenResults
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
