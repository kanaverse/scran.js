import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import * as gc from "./gc.js";
import { BuildNeighborSearchIndexResults, findNearestNeighbors } from "./findNearestNeighbors.js";

/**
 * Wrapper around the UMAP status object on the Wasm heap, typically created by {@linkcode initializeUmap}.
 * @hideconstructor
 */
export class UmapStatus {
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
     * @return {UmapStatus} A deep copy of this object.
     */
    clone() {
        let coord_copy = this.#coordinates.clone();
        return gc.call(
            module => this.#status.deepcopy(coord_copy.offset), 
            UmapStatus, 
            coord_copy
        );
    }

    /**
     * @return {number} Number of cells in the dataset.
     */
    numberOfCells () {
        return this.#status.num_observations();
    }

    /**
     * @return {number} Number of epochs processed so far.
     * This changes with repeated invocations of {@linkcode runUmap}, up to the maximum in {@linkcode UmapStatus#totalEpochs totalEpochs}.
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
     * Run the UMAP algorithm for a certain time.
     * This method may be called any number of times.
     *
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.runTime=null] - Number of milliseconds for which the algorithm is allowed to run before returning.
     * If `null`, no limit is imposed on the runtime.
     *
     * @return The algorithm status in `x` is advanced up to the total number of epochs used to initialize `x`,
     * or until the requested run time is exceeded, whichever comes first.
     */
    run(options = {}) {
        let { runTime = null, ...others } = options;
        utils.checkOtherOptions(others);
        if (runTime === null) {
            runTime = -1;
        }
        wasm.call(module => module.run_umap(this.#status, runTime));
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
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.neighbors=15] - Number of neighbors to use in the UMAP algorithm.
 * Ignored if `x` is a {@linkplain FindNearestNeighborsResults} object.
 * @param {number} [options.epochs=500] - Number of epochs to run the UMAP algorithm.
 * @param {number} [options.minDist=0.01] - Minimum distance between points in the UMAP algorithm.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {UmapStatus} Object containing the initial status of the UMAP algorithm.
 */
export function initializeUmap(x, options = {}) {
    const { neighbors = 15, epochs = 500, minDist = 0.01, numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);

    var my_neighbors;
    var raw_coords;
    var output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        let nnres;

        if (x instanceof BuildNeighborSearchIndexResults) {
            my_neighbors = findNearestNeighbors(x, neighbors, { numberOfThreads: nthreads });
            nnres = my_neighbors;
        } else {
            nnres = x;
        }

        raw_coords = utils.createFloat32WasmArray(2 * nnres.numberOfCells());
        output = gc.call(
            module => module.initialize_umap(nnres.results, epochs, minDist, raw_coords.offset, nthreads),
            UmapStatus,
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
 * Run the UMAP algorithm.
 * This is a wrapper around {@linkcode initializeUmap} and {@linkcode UmapStatus#run run}.
 *
 * @param {(BuildNeighborSearchIndexResults|FindNearestNeighborsResults)} x 
 * Either a pre-built neighbor search index for the dataset (see {@linkcode buildNeighborSearchIndex}),
 * or a pre-computed set of neighbor search results for all cells (see {@linkcode findNearestNeighbors}).
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.neighbors=15] - Number of neighbors to use in the UMAP algorithm.
 * Ignored if `x` is a {@linkplain FindNearestNeighborsResults} object.
 * @param {number} [options.epochs=500] - Number of epochs to run the UMAP algorithm.
 * @param {number} [options.minDist=0.01] - Minimum distance between points in the UMAP algorithm.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {object} Object containing coordinates of the UMAP embedding, see {@linkcode UmapStatus#extractCoordinates UmapStatus.extractCoordinates} for more details.
 */
export function runUmap(x, options = {}){
    const { neighbors = 15, epochs = 500, minDist = 0.01, numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);
    let ustat = initializeUmap(x, { neighbors, epochs, minDist, numberOfThreads });
    ustat.run();
    return ustat.extractCoordinates();
}
