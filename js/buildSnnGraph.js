import * as utils from "./utils.js";
import * as gc from "./gc.js";
import { FindNearestNeighborsResults, findNearestNeighbors } from "./findNearestNeighbors.js";

/**
 * Wrapper around the SNN graph object on the Wasm heap, produced by {@linkcode buildSnnGraph}.
 * @hideconstructor
 */
export class BuildSnnGraphResults {
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
 * @param {BuildNeighborSearchIndexResults|FindNearestNeighborsResults} x 
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
 * @return {BuildSnnGraphResults} Object containing the graph.
 */
export function buildSnnGraph(x, { scheme = "rank", neighbors = 10, numberOfThreads = null } = {}) {
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
            BuildSnnGraphResults
        );

    } catch(e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(my_neighbors);
    }

    return output;
}

