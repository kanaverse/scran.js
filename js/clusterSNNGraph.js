import Module from "./Module.js";
import * as utils from "./utils.js";

/**
 * Wrapper around the SNN multi-level clustering results on the Wasm heap.
 */
export class SNNGraphMultilevelClusters {
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
     * @param {?number} level The clustering level for which to obtain the modularity.
     * Defaults to the best clustering level from `best()`.
     *
     * @return The modularity at the specified level.
     */
    modularity(level = null) {
        if (level === null) {
            level = this.best();
        }
        return this.results.modularity(level);
    }

    /**
     * @param {?number} level The clustering level for which to obtain the cluster membership.
     * Defaults to the best clustering level from `best()`.
     * @param {boolean} copy Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return An `Int32Array` (or view thereof) containing the cluster membership for each cell.
     */
    membership(level = null, copy = true) {
        if (level === null) {
            level = this.best();
        }
        var output = this.results.membership(level);
        if (copy) {
            return output.slice();
        } else {
            return output;
        }
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        this.results.delete();
        this.results = null;
        return;
    }
}

/**
 * Cluster cells using community detection on the SNN graph.
 *
 * @param {SNNGraph} x The shared nearest neighbor graph constructed by `buildSNNGraph()`.
 * @param {number} resolution The resolution of the multi-level clustering.
 *
 * @return A `SNNGraphMultilevelClusters` object containing the clustering results.
 */
export function clusterSNNGraph(x, resolution = 1) {
    var raw;
    var output;

    try {
        raw = utils.wrapModuleCall(() => Module.cluster_snn_graph(x.graph, resolution));
        output = new SNNGraphMultilevelClusters(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    }

    return output;
}
