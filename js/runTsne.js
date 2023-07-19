import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import * as gc from "./gc.js";
import { BuildNeighborSearchIndexResults, findNearestNeighbors } from "./findNearestNeighbors.js";

/**
 * Wrapper around the t-SNE status object on the Wasm heap, typically created by {@linkcode initializeTSNE}.
 * @hideconstructor
 */
export class InitializeTSNEResults {
    #id;
    #status;
    #coordinates;

    constructor(id, raw_status, raw_coordinates) {
        this.#id = id;
        this.#status = raw_status;
        this.#coordinates = raw_coordinates;
        return;
    }

    // Internal use only, not documented.
    get status() {
        return this.#status;
    }

    // Internal use only, not documented.
    get coordinates() {
        return this.#coordinates;
    }

    /**
     * @return {InitializeTSNEResults} A deep copy of this object.
     */
    clone() {
        return gc.call(
            module => this.#status.deepcopy(), 
            InitializeTSNEResults, 
            this.#coordinates.clone()
        );
    }

    /**
     * @return {number} Number of cells in the dataset.
     */
    numberOfCells () {
        return this.#status.num_obs();
    }

    /**
     * @return {number} Number of iterations processed so far.
     * This will change with repeated invocations of {@linkcode runTsne} on this object.
     */
    iterations () {
        return this.#status.iterations();
    }

    /**
     * @return {object} Object with `x` and `y` keys.
     * The corresponding values are Float64Array objects of length equal to the number of cells,
     * containing the x- and  y- coordinates for each cell at the current state of the algorithm.
     */
    extractCoordinates() {
        return utils.extractXY(this.numberOfCells(), this.#coordinates.array()); 
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */   
    free() {
        if (this.#status !== null) {
            gc.release(this.#id);
            this.#status = null;
        }
        if (this.#coordinates !== null) {
            this.#coordinates.free();
            this.#coordinates = null;
        }
        return;
    }
}

/**
 * @param {number} perplexity - Perplexity to use in the t-SNE algorithm.
 * @return {number} Appropriate number of neighbors to use in the nearest neighbor search.
 */
export function perplexityToNeighbors(perplexity) {
    return wasm.call(module => module.perplexity_to_k(perplexity));
}

/**
 * @param {(BuildNeighborSearchIndexResults|FindNearestNeighborsResults)} x 
 * Either a pre-built neighbor search index for the dataset (see {@linkcode buildNeighborSearchIndex}),
 * or a pre-computed set of neighbor search results for all cells (see {@linkcode findNearestNeighbors}).
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.perplexity=30] - Perplexity to use when computing neighbor probabilities in the t-SNE.
 * @param {boolean} [options.checkMismatch=true] - Whether to check for a mismatch between the perplexity and the number of searched neighbors.
 * Only relevant if `x` is a {@linkplain FindNearestNeighborsResults} object.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {InitializeTSNEResults} Object containing the initial status of the t-SNE algorithm.
 */
export function initializeTSNE(x, { perplexity = 30, checkMismatch = true, numberOfThreads = null } = {}) {
    var my_neighbors;
    var raw_coords;
    var output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        let neighbors;

        if (x instanceof BuildNeighborSearchIndexResults) {
            let k = perplexityToNeighbors(perplexity);
            my_neighbors = findNearestNeighbors(x, k, { numberOfThreads: nthreads });
            neighbors = my_neighbors;

        } else {
            if (checkMismatch) {
                let k = perplexityToNeighbors(perplexity);
                if (k * x.numberOfCells() != x.size()) {
                    throw new Error("number of neighbors in 'x' does not match '3 * perplexity'");
                }
            }
            neighbors = x;
        }

        raw_coords = utils.createFloat64WasmArray(2 * neighbors.numberOfCells());
        wasm.call(module => module.randomize_tsne_start(neighbors.numberOfCells(), raw_coords.offset, 42));
        output = gc.call(
            module => module.initialize_tsne(neighbors.results, perplexity, nthreads),
            InitializeTSNEResults,
            raw_coords
        );

    } catch(e) {
        utils.free(output);
        utils.free(raw_coords);
        throw e;

    } finally {
        utils.free(my_neighbors);
    }

    return output;
}

/**
 * Run the t-SNE algorithm on an initialized {@linkplain InitializeTSNEResults}.
 *
 * @param {InitializeTSNEResults} x A previously initialized status object from {@linkcode initializeTSNE}.
 * This may be passed through {@linkcode runTsne} any number of times.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.maxIterations=1000] - Maximum number of iterations to perform.
 * This number includes all existing iterations that were already performed in `x` from previous calls to {@linkcode runTsne}.
 * @param {?number} [options.runTime=null] - Number of milliseconds for which the algorithm is allowed to run before returning.
 * If `null`, no limit is imposed on the runtime.
 *
 * @return The algorithm status in `x` is advanced up to the requested number of iterations,
 * or until the requested run time is exceeded, whichever comes first.
 */
export function runTsne(x, { maxIterations = 1000, runTime = null } = {}) {
    if (runTime === null) {
        runTime = -1;
    }
    wasm.call(module => module.run_tsne(x.status, runTime, maxIterations, x.coordinates.offset));
    return;
}
