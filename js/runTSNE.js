import * as utils from "./utils.js";
import Module from "./Module.js";
import { NeighborSearchIndex } from "./buildNeighborSearchIndex.js";
import { findNearestNeighbors } from "./findNearestNeighbors.js";
import { Float64WasmArray } from "./WasmArray.js";

/**
 * Wrapper around the t-SNE status object on the Wasm heap.
 */
export class TSNEStatus {
    /**
     * @param {Object} raw_status Status object allocated on the Wasm heap.
     * @param {Float64WasmArray} raw_coordinates Buffer containing the initial t-SNE coordinates.
     *
     * This should not be called directly by developers;
     * use `initializeTSNE()` instead.
     */
    constructor(raw_status, raw_coordinates) {
        this.status = raw_status;
        this.coordinates = raw_coordinates;
        return;
    }

    /**
     * @return A deep copy of the status object.
     */
    clone() {
        let coords = new Float64WasmArray(this.coordinates.length);
        coords.set(this.coordinates.array());
        return new TSNEStatus(this.status.deepcopy(), coords);
    }

    /**
     * @return Number of cells in the dataset.
     */
    numberOfCells () {
        return this.status.num_obs();
    }

    /**
     * @return Number of iterations processed so far.
     * This changes with repeated invocations of `runTSNE()`.
     */
    iterations () {
        return this.status.iterations();
    }

    /**
     * @return Object with `x` and `y` keys,
     * where values are `Float64Array` objects of length equal to the number of cells,
     * containing the x- and  y- coordinates for each cell at the current state of the algorithm.
     */
    extractCoordinates() {
        return utils.extractXY(this.numberOfCells(), this.coordinates.array()); 
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */   
    free () {
        this.status.delete();
        this.coordinates.free();
        this.status = null;
        this.coordinates = null;
        return;
    }
}

/**
 * @param {(NeighborSearchIndex|NeighborSearchResults)} x 
 * Either a pre-built neighbor search index for the dataset (see `buildNeighborSearchIndex()`),
 * or a pre-computed set of neighbor search results for all cells (see `findNearestNeighbors()`).
 * @param {number} perplexity Perplexity to use when computing neighbor probabilities in the t-SNE.
 * @param {boolean} checkMismatch Whether to check for a mismatch between the perplexity and the number of searched neighbors.
 * Only relevant if `x` is a `NeighborSearchResults` object.
 *
 * @return A `TSNEStatus` object containing the initial status of the t-SNE algorithm.
 */
export function initializeTSNE(x, perplexity = 30, checkMismatch = true) {
    var my_neighbors;
    var raw_status;
    var raw_coords;
    var output;

    try {
        let neighbors;

        if (x instanceof NeighborSearchIndex) {
            let k = utils.wrapModuleCall(() => Module.perplexity_to_k(perplexity));
            my_neighbors = findNearestNeighbors(x, k);
            neighbors = my_neighbors;

        } else {
            if (checkMismatch) {
                let k = utils.wrapModuleCall(() => Module.perplexity_to_k(perplexity));
                if (k * x.numberOfCells() != x.size()) {
                    throw "number of neighbors in 'x' does not match '3 * perplexity'";
                }
            }
            neighbors = x;
        }

        raw_status = utils.wrapModuleCall(() => Module.initialize_tsne(neighbors.results, perplexity));
        raw_coords = new Float64WasmArray(2 * neighbors.numberOfCells());
        utils.wrapModuleCall(() => Module.randomize_tsne_start(neighbors.numberOfCells(), raw_coords.offset, 42));
        output = new TSNEStatus(raw_status, raw_coords);

    } catch(e) {
        utils.free(raw_status);
        utils.free(raw_coords);
        throw e;

    } finally {
        utils.free(my_neighbors);
    }

    return output;
}

/**
 * Run the t-SNE algorithm on an initialized `TSNEStatus`.
 *
 * @param {TSNEStatus} x A previously initialized status object.
 * This may be passed through `runTSNE()` any number of times.
 * @param {number} maxIterations Maximum number of iterations to perform.
 * This will also count all existing iterations from previous calls to `runTSNE()`.
 * @param {?number} runTime Number of milliseconds for which the algorithm is allowed to run before returning.
 * If `null`, no limit is imposed on the runtime.
 *
 * @return The algorithm status in `x` is advanced up to the requested number of iterations,
 * or until the requested run time is exceeded, whichever comes first.
 */
export function runTSNE(x, maxIterations = 1000, runTime = null) {
    if (runTime === null) {
        runTime = 100000000; // TODO: need a better solution here.
    }
    utils.wrapModuleCall(() => Module.run_tsne(x.status, runTime, maxIterations, x.coordinates.offset));
    return;
}
