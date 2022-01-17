import Module from "./Module.js";
import * as utils from "./utils.js";

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
        this.graph.delete();
        this.graph = null;
        return;
    }
}

/**
 * Build a shared nearest graph.
 *
 * @param {NeighborSearchResults} x Neighbor search results from `findNearestNeighbors()`.
 * @param {number} scheme Weighting scheme for the edges between cells.
 * This can be based on the top ranks of the shared neighbors (0),
 * the number of shared neighbors (1) 
 * or the Jaccard index of the neighbor sets between cells (2).
 *
 * @return A `SNNGraph` object containing the graph.
 */
export function buildSNNGraph(x, scheme = 0) {
    var raw;
    var output;

    try {
        raw = utils.wrapModuleCall(() => Module.build_snn_graph(x.results, scheme));
        output = new SNNGraph(raw);
    } catch(e) {
        utils.free(raw);
        throw e;
    }

    return output;
}
