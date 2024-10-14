import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import * as gc from "./gc.js";
import { BuildNeighborSearchIndexResults, findNearestNeighbors } from "./findNearestNeighbors.js";

/**
 * Wrapper around the t-SNE status object on the Wasm heap, typically created by {@linkcode initializeTsne}.
 * @hideconstructor
 */
export class TsneStatus {
    #id;
    #status;
    #coordinates;

    constructor(id, raw_status, raw_coordinates) {
        this.#id = id;
        this.#status = raw_status;
        this.#coordinates = raw_coordinates;
        return;
    }

    /**
     * @return {TsneStatus} A deep copy of this object.
     */
    clone() {
        return gc.call(
            module => this.#status.deepcopy(), 
            TsneStatus, 
            this.#coordinates.clone()
        );
    }

    /**
     * @return {number} Number of cells in the dataset.
     */
    numberOfCells () {
        return this.#status.num_observations();
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
     * Run the t-SNE algorithm to the specified number of iterations or for a certain time.
     * This method may be called any number of times.
     *
     * @param {object} [options={}] - Optional parameters.
     * @param {number} [options.maxIterations=1000] - Maximum number of iterations to perform.
     * This number includes all existing iterations that were already performed in `x` from previous calls to this method,
     * so it should be greater than {@linkcode TsneStatus#iterations iterations}.
     * @param {?number} [options.runTime=null] - Number of milliseconds for which the algorithm is allowed to run before returning.
     * If `null`, no limit is imposed on the runtime.
     *
     * @return The algorithm status in `x` is advanced up to the requested number of iterations,
     * or until the requested run time is exceeded, whichever comes first.
     */
    run(options = {}) {
        let { maxIterations = 1000, runTime = null, ...others } = options;
        utils.checkOtherOptions(others);
        if (runTime === null) {
            runTime = -1;
        }
        wasm.call(module => module.run_tsne(this.#status, runTime, maxIterations, this.#coordinates.offset));
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
 * @param {BuildNeighborSearchIndexResults|FindNearestNeighborsResults} x A pre-built neighbor search index from {@linkcode buildNeighborSearchIndex}.
 *
 * Alternatively, a pre-computed set of neighbor search results from {linkcode findNearestNeighbors}.
 * The number of neighbors should be equal to `neighbors`, otherwise a warning is raised.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.perplexity=30] - Perplexity to use when computing neighbor probabilities in the t-SNE.
 * @param {?number} [options.neighbors=null] - Number of nearest neighbors to find.
 * If `null`, defaults to the output of {@linkcode perplexityToNeighbors perplexityToNeighbors(perplexity)}.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {TsneStatus} Object containing the initial status of the t-SNE algorithm.
 */
export function initializeTsne(x, options = {}) {
    const { perplexity = 30, neighbors = null, numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);

    var my_nnres;
    var raw_coords;
    var output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    const k = (neighbors == null ? perplexityToNeighbors(perplexity) : neighbors);

    try {
        let nnres;

        if (x instanceof BuildNeighborSearchIndexResults) {
            my_nnres = findNearestNeighbors(x, k, { numberOfThreads: nthreads });
            nnres = my_nnres
        } else {
            if (k != x.numberOfNeighbors()) {
                console.warn("number of neighbors in 'x' does not match 'neighbors'");
            }
            nnres = x;
        }

        raw_coords = utils.createFloat64WasmArray(2 * nnres.numberOfCells());
        wasm.call(module => module.randomize_tsne_start(nnres.numberOfCells(), raw_coords.offset, 42));
        output = gc.call(
            module => module.initialize_tsne(nnres.results, perplexity, nthreads),
            TsneStatus,
            raw_coords
        );

    } catch(e) {
        utils.free(output);
        utils.free(raw_coords);
        throw e;

    } finally {
        utils.free(my_nnres);
    }

    return output;
}

/**
 * Run the t-SNE algorithm to the specified number of iterations.
 * This is a wrapper around {@linkcode initializeTsne} and {@linkcode TsneStatus#run run}.
 *
 * @param {BuildNeighborSearchIndexResults|FindNearestNeighborsResults} x A pre-built neighbor search index from {@linkcode buildNeighborSearchIndex}.
 *
 * Alternatively, a pre-computed set of neighbor search results from {linkcode findNearestNeighbors}.
 * The number of neighbors should be equal to `neighbors`, otherwise a warning is raised.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.perplexity=30] - Perplexity to use when computing neighbor probabilities in the t-SNE.
 * @param {?number} [options.neighbors=null] - Number of nearest neighbors to find.
 * If `null`, defaults to the output of {@linkcode perplexityToNeighbors perplexityToNeighbors(perplexity)}.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 * @param {number} [options.maxIterations=1000] - Maximum number of iterations to perform.
 *
 * @return {object} Object containing coordinates of the t-SNE embedding, see {@linkcode TsneStatus#extractCoordinates TsneStatus.extractCoordinates} for more details.
 */
export function runTsne(x, options = {}) {
    const { perplexity = 30, neighbors = null, numberOfThreads = null, maxIterations = 1000, ...others } = options;
    utils.checkOtherOptions(others);
    let tstat = initializeTsne(x, { perplexity, neighbors, numberOfThreads });
    tstat.run({ maxIterations });
    return tstat.extractCoordinates();
}
