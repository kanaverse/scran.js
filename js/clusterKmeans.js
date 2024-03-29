import * as utils from "./utils.js";
import * as gc from "./gc.js";
import { RunPcaResults } from "./runPca.js";

/**
 * Wrapper around the k-means clustering results on the Wasm heap, produced by {@linkcode clusterKmeans}.
 * @hideconstructor
 */
export class ClusterKmeansResults {
    #id;
    #results;

    #filledClusters;
    #filledSizes;
    #filledCenters;
    #filledWcss;
    #filledIterations;
    #filledStatus;

    constructor(id, raw, filled = true) {
        this.#results = raw;
        this.#id = id;

        this.#filledClusters = filled;
        this.#filledSizes = filled;
        this.#filledCenters = filled;
        this.#filledWcss = filled;
        this.#filledIterations = filled;
        this.#filledStatus = filled;

        return;
    }

    /**
     * @return {number} Number of cells in the results.
     */
    numberOfCells() {
        return this.#results.num_obs();
    }

    /**
     * @return {number} Number of clusters in the results.
     */
    numberOfClusters() {
        return this.#results.num_clusters();
    }

    /**
     * @param {number} iterations - Number of iterations.
     * @return The specified number of iterations is set in this object.
     * Typically only used after {@linkcode emptyClusterKmeansResults}.
     */
    setIterations(iterations) {
        if (!this.#filledIterations) {
            this.#filledIterations = true;
        }
        this.#results.set_iterations(iterations);
        return;
    }

    /**
     * @param {number} status - Status of the k-means clustering.
     * @return The status is set in this object.
     * Typically only used after {@linkcode emptyClusterKmeansResults}.
     */
    setStatus(status) {
        if (!this.#filledStatus) {
            this.#filledStatus = true;
        }
        this.#results.set_status(status);
        return;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Int32Array|Int32WasmArray)} Array containing the cluster assignment for each cell.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    clusters({ copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledClusters, 
            () => { this.#filledClusters = true }, 
            COPY => utils.possibleCopy(this.#results.clusters(), COPY),
            "clusters"
        );
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Int32Array|Int32WasmArray)} Array containing the number of cells in each cluster.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    clusterSizes({ copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledSizes, 
            () => { this.#filledSizes = true }, 
            COPY => utils.possibleCopy(this.#results.cluster_sizes(), COPY),
            "clusterSizes"
        );
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array containing the within-cluster sum of squares in each cluster.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    withinClusterSumSquares({ copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledWcss, 
            () => { this.#filledWcss = true }, 
            COPY => utils.possibleCopy(this.#results.wcss(), COPY)
        );
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @param {boolean} [options.fillable=false] - Whether to return a fillable array, to write to this object.
     * If `true`, this method automatically sets `copy = false` if `copy` was previously true.
     * If `false` and the array was not previously filled, `null` is returned.
     *
     * @return {?(Float64Array|Float64WasmArray)} Array containing the cluster centers in column-major format,
     * where rows are dimensions and columns are the clusters.
     * Alternatively `null`, if `fillable = false` and the array was not already filled.
     */
    clusterCenters({ copy = true, fillable = false } = {}) {
        return utils.checkFillness(
            fillable, 
            copy, 
            this.#filledCenters, 
            () => { this.#filledCenters = true }, 
            COPY => utils.possibleCopy(this.#results.centers(), COPY)
        );
    }

    /**
     * @return {?number} Number of refinement iterations performed by the algorithm.
     * Alternatively `null`, if this value has not been filled by {@linkcode ClusterKmeansResults#setIterations setIterations}.
     */
    iterations() {
        if (!this.#filledIterations) {
            return null;
        } else {
            return this.#results.iterations();
        }
    }

    /**
     * @return {?number} Status of the algorithm - anything other than zero usually indicates a problem with convergence.
     * Alternatively `null`, if this value has not been filled by {@linkcode ClusterKmeansResults#setStatus setStatus}.
     */
    status() {
        if (!this.#filledStatus) {
            return null;
        } else {
            return this.#results.status();
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
 * Cluster cells using k-means.
 *
* @param {(RunPcaResults|Float64WasmArray|Array|TypedArray)} x - Numeric coordinates of each cell in the dataset.
 * For array inputs, this is expected to be in column-major format where the rows are the variables and the columns are the cells.
 * For a {@linkplain RunPcaResults} input, we extract the principal components.
 * @param {number} clusters Number of clusters to create.
 * This should not be greater than the number of cells.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfDims=null] - Number of variables/dimensions per cell.
 * Only used (and required) for array-like `x`.
 * @param {?number} [options.numberOfCells=null] - Number of cells.
 * Only used (and required) for array-like `x`.
 * @param {string} [options.initMethod="pca-part"] - Initialization method.
 * Setting `"random"` will randomly select `clusters` cells as centers.
 * Setting `"kmeans++"` will use the weighted sampling approach of Arthur and Vassilvitskii (2007).
 * Setting `"pca-part"` will use PCA partitioning.
 * @param {number} [options.initSeed=5768] - Seed to use for random number generation during initialization.
 * @param {number} [options.initPCASizeAdjust=1] - Adjustment factor for the cluster sizes, used when `initMethod = "pca-part"`.
 * Larger values (up to 1) will prioritize partitioning of clusters with more cells.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {ClusterKmeansResults} Object containing the clustering results.
 */
export function clusterKmeans(x, clusters, { numberOfDims = null, numberOfCells = null, initMethod = "pca-part", initSeed = 5768, initPCASizeAdjust = 1, numberOfThreads = null } = {}) {
    var buffer;
    var output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        let pptr;

        if (x instanceof RunPcaResults) {
            numberOfDims = x.numberOfPCs();
            numberOfCells = x.numberOfCells();
            let pcs = x.principalComponents({ copy: false });
            pptr = pcs.byteOffset;

        } else {
            if (numberOfDims === null || numberOfCells === null) {
                throw new Error("'numberOfDims' and 'numberOfCells' must be specified when 'x' is an Array");
            }

            buffer = utils.wasmifyArray(x, "Float64WasmArray");
            if (buffer.length != numberOfDims * numberOfCells) {
                throw new Error("length of 'x' must be the product of 'numberOfDims' and 'numberOfCells'");
            }

            pptr = buffer.offset;
        }

        output = gc.call(
            module => module.cluster_kmeans(pptr, numberOfDims, numberOfCells, clusters, initMethod, initSeed, initPCASizeAdjust, nthreads),
            ClusterKmeansResults
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(buffer);
    }

    return output;
}
