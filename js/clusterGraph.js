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

    constructor(id, raw) {
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
    modularity(options = {}) {
        let { level = null, ...others } = options;
        utils.checkOtherOptions(others);
        if (level == null) {
            return this.#results.best_modularity();
        } else {
            return this.#results.modularity(level);
        }
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.level=null] - The clustering level for which to obtain the cluster membership.
     * Defaults to the best clustering level from {@linkcode ClusterMultilevelResults#bestLevel bestLevel}.
     * @param {boolean} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * Only used if `level=null`, otherwise a copy is always made.
     *
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership(options = {}) {
        let { level = null, copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        if (level == null) {
            return utils.possibleCopy(this.#results.best_membership(), copy);
        } else {
            // We must take a copy as this is transient memory.
            return this.#results.membership(level).slice();
        }
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

    constructor(id, raw) {
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
    modularity(options = {}) {
        let { at = null, ...others } = options;
        utils.checkOtherOptions(others);
        if (at === null) {
            return this.#results.best_modularity();
        } else {
            return this.#results.modularity(at);
        }
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Int32Array|Int32WasmArray} Array containing the cluster membership for each cell.
     */
    membership(options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
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
    membership(options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
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
 * @param {boolean} [options.leidenObjective="cpm"] - Objective function to use when `method = "leiden"`.
 * This can be the Constant-Potts Model (`cpm`), the graph modularity (`modularity`), or the Erdős-Rényi model (`er`).
 * Set to `modularity` to get an interpretation of the resolution on par with that of `method = "multilevel"`.
 * @param {number} [options.walktrapSteps=4] - Number of steps for the Walktrap algorithm, when `method = "walktrap"`.
 *
 * @return {ClusterMultiLevelResults|ClusterWalktrapResults|ClusterLeidenResults} Object containing the clustering results.
 * The class of this object depends on the choice of `method`.
 */
export function clusterGraph(x, options = {}) {
    const { 
        method = "multilevel", 
        multiLevelResolution = 1, 
        leidenResolution = 1, 
        leidenObjective = "cpm",
        leidenModularityObjective = false, // For back-compatibility only.
        walktrapSteps = 4,
        ...others
    } = options;
    utils.checkOtherOptions(others);

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
            if (leidenModularityObjective) { // for back-compatibility.
                leidenObjective = "modularity";
            }
            output = gc.call(
                module => module.cluster_leiden(x.graph, leidenResolution, leidenObjective),
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
