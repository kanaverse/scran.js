import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import * as gc from "./gc.js";
import { BuildNeighborSearchIndexResults, findNearestNeighbors } from "./findNearestNeighbors.js";

/**
 * Wrapper around the UMAP status object on the Wasm heap, typically created by {@linkcode initializeUMAP}.
 * @hideconstructor
 */
export class InitializeUMAPResults {
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
     * @return {InitializeUMAPResults} A deep copy of this object.
     */
    clone() {
        return gc.call(
            module => this.#status.deepcopy(), 
            InitializeUMAPResults, 
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
     * @return {number} Number of epochs processed so far.
     * This changes with repeated invocations of {@linkcode runUMAP}, up to the maximum in {@linkcode InitializeUMAPResults#totalEpochs totalEpochs}.
     */
    currentEpoch() {
        return this.#status.epoch();
    }

    /**
     * @return {number} Total number of epochs used to initialize this object.
     */
    totalEpochs() {
        return this.#status.num_epochs();
    }

    /**
     * @return {object} Object with `x` and `y` keys.
     * Corresponding values are Float64Array objects of length equal to the number of cells,
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
 * @param {(BuildNeighborSearchIndexResults|FindNearestNeighborsResults)} x 
 * Either a pre-built neighbor search index for the dataset (see {@linkcode buildNeighborSearchIndex}),
 * or a pre-computed set of neighbor search results for all cells (see {@linkcode findNearestNeighbors}).
 * @param {object} [options] - Optional parameters.
 * @param {number} [options.neighbors=15] - Number of neighbors to use in the UMAP algorithm.
 * Ignored if `x` is a {@linkplain FindNearestNeighborsResults} object.
 * @param {number} [options.epochs=500] - Number of epochs to run the UMAP algorithm.
 * @param {number} [options.minDist=0.01] - Minimum distance between points in the UMAP algorithm.
 *
 * @return {InitializeUMAPResults} Object containing the initial status of the UMAP algorithm.
 */
export function initializeUMAP(x, { neighbors = 15, epochs = 500, minDist = 0.01 } = {}) {
    var my_neighbors;
    var raw_coords;
    var output;

    try {
        let nnres;

        if (x instanceof BuildNeighborSearchIndexResults) {
            my_neighbors = findNearestNeighbors(x, neighbors);
            nnres = my_neighbors;
        } else {
            nnres = x;
        }

        raw_coords = utils.createFloat64WasmArray(2 * nnres.numberOfCells());
        output = gc.call(
            module => module.initialize_umap(nnres.results, epochs, minDist, raw_coords.offset),
            InitializeUMAPResults,
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
 * Run the UMAP algorithm on an initialized {@linkplain InitializeUMAPResults}.
 *
 * @param {InitializeUMAPResults} x A previously initialized status object from {@linkcode initializeUMAP}.
 * This may be passed through {@linkcode runUMAP} any number of times.
 * @param {object} [options] - Optional parameters.
 * @param {?number} [options.runTime=null] - Number of milliseconds for which the algorithm is allowed to run before returning.
 * If `null`, no limit is imposed on the runtime.
 *
 * @return The algorithm status in `x` is advanced up to the total number of epochs used to initialize `x`,
 * or until the requested run time is exceeded, whichever comes first.
 */
export function runUMAP(x, { runTime = null } = {}) {
    if (runTime === null) {
        runTime = -1;
    }
    wasm.call(module => module.run_umap(x.status, runTime, x.coordinates.offset));
    return;
}
