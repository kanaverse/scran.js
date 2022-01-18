import * as utils from "./utils.js";
import Module from "./Module.js";
import { NeighborSearchIndex, findNearestNeighbors } from "./findNearestNeighbors.js";
import { Float64WasmArray } from "./WasmArray.js";

/**
 * Wrapper around the UMAP status object on the Wasm heap.
 */
export class UMAPStatus {
    /**
     * @param {Object} raw_status Status object allocated on the Wasm heap.
     * @param {Float64WasmArray} raw_coordinates Buffer containing the initial UMAP coordinates.
     *
     * This should not be called directly by developers;
     * use `initializeUMAP()` instead.
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
        return new UMAPStatus(this.status.deepcopy(), this.coordinates.clone());
    }

    /**
     * @return Number of cells in the dataset.
     */
    numberOfCells () {
        return this.status.num_obs();
    }

    /**
     * @return Number of epochs processed so far.
     * This changes with repeated invocations of `runUMAP()`.
     */
    currentEpoch() {
        return this.status.epoch();
    }

    /**
     * @return Total number of epochs used to initialize this object.
     */
    totalEpochs() {
        return this.status.total_epochs();
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
 * @param {number} neighbors Number of neighbors to use in the UMAP algorithm.
 * Ignored if `x` is a `NeighborSearchResults` object.
 * @param {number} epochs Number of epochs to run the UMAP algorithm.
 * @param {number} minDist Minimum distance between points in the UMAP algorithm.
 *
 * @return A `UMAPStatus` object containing the initial status of the UMAP algorithm.
 */
export function initializeUMAP(x, neighbors = 15, epochs = 500, minDist = 0.01) {
    var my_neighbors;
    var raw_status;
    var raw_coords;
    var output;

    try {
        let nnres;

        if (x instanceof NeighborSearchIndex) {
            my_neighbors = findNearestNeighbors(x, neighbors);
            nnres = my_neighbors;
        } else {
            nnres = x;
        }

        raw_coords = new Float64WasmArray(2 * nnres.numberOfCells());
        raw_status = utils.wrapModuleCall(() => Module.initialize_umap(nnres.results, epochs, minDist, raw_coords.offset))
        output = new UMAPStatus(raw_status, raw_coords);

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
 * Run the UMAP algorithm on an initialized `UMAPStatus`.
 *
 * @param {UMAPStatus} x A previously initialized status object.
 * This may be passed through `runUMAP()` any number of times.
 * @param {?number} runTime Number of milliseconds for which the algorithm is allowed to run before returning.
 * If `null`, no limit is imposed on the runtime.
 *
 * @return The algorithm status in `x` is advanced up to the total number of epochs used to initialize `x`,
 * or until the requested run time is exceeded, whichever comes first.
 */
export function runUMAP(x, runTime = null) {
    if (runTime === null) {
        runTime = 100000000; // TODO: need a better solution here.
    }
    utils.wrapModuleCall(() => Module.run_umap(x.status, runTime, x.coordinates.offset));
    return;
}
