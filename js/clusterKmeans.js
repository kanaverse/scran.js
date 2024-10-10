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

    constructor(id, raw, filled = true) {
        this.#results = raw;
        this.#id = id;
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
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Int32Array|Int32WasmArray} Array containing the cluster assignment for each cell.
     */
    clusters({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.clusters(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Int32Array|Int32WasmArray} Array containing the number of cells in each cluster.
     */
    sizes({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.cluster_sizes(), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Whether to copy the results from the Wasm heap, see {@linkcode possibleCopy}.
     * @return {Float64Array|Float64WasmArray} Array containing the cluster centers in column-major format,
     * where rows are dimensions and columns are the clusters.
     */
    centers({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.centers(), copy);
    }

    /**
     * @return {number} Number of refinement iterations performed by the algorithm.
     */
    iterations() {
        return this.#results.iterations();
    }

    /**
     * @return {number} Status of the algorithm - anything other than zero usually indicates a problem with convergence.
     */
    status() {
        return this.#results.status();
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
 * A variety of initialization and refinement algorithms can be used here, see the [**kmeans** documentation](https://github.com/LTLA/CppKmeans) for more details.
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
 * Setting `"var-part"` will use variance partitioning from Su and Dy (2007).
 * @param {number} [options.initSeed=5768] - Seed to use for random number generation during initialization.
 * @param {number} [options.initVarPartSizeAdjust=1] - Adjustment factor for the cluster sizes, used when `initMethod = "var-part"`.
 * Larger values (up to 1) will prioritize partitioning of clusters with more cells.
 * @param {boolean} [options.initVarPartOptimize=true] - Whether to optimize the partition at each step to minimize the sum of squares, when `initMethod = "var-part"`.
 * @param {string} [options.refineMethod="hartigan-wong"] - Refinement method.
 * This can be either `"hartigan-wong"` or `"lloyd"`.
 * @param {number} [options.refineLloydIterations=10] - Number of iterations for the Lloyd refinement algorithm.
 * @param {number} [options.refineHartiganWong=10] - Number of iterations for the Hartigan-Wong refinement algorithm.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {ClusterKmeansResults} Object containing the clustering results.
 */
export function clusterKmeans(x, clusters, { 
    numberOfDims = null, 
    numberOfCells = null, 
    initMethod = "var-part", 
    initSeed = 5768, 
    initVarPartSizeAdjust = 1, 
    initVarPartOptimize = true, 
    refineMethod = "hartigan-wong",
    refineLloydIterations = 100,
    refineHartiganWongIterations = 10,
    numberOfThreads = null 
} = {}) {
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
            module => module.cluster_kmeans(
                pptr,
                numberOfDims,
                numberOfCells,
                clusters,
                initMethod,
                initSeed,
                initVarPartSizeAdjust,
                initVarPartOptimize,
                refineMethod,
                refineLloydIterations,
                refineHartiganWongIterations,
                nthreads
            ),
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
