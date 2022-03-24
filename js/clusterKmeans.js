import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { PCAResults } from "./runPCA.js";

/**
 * Wrapper around the k-emans clustering results on the Wasm heap.
 */
export class KmeansClusters {
    /**
     * @param {Object} raw Results allocated on the Wasm heap.
     *
     * This should not be called directly by developers,
     * call `clusterKmeans()` instead.
     */
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return Number of cells in the results.
     */
    numberOfCells() {
        return this.results.num_obs();
    }

    /**
     * @return Number of clusters in the results.
     */
    numberOfClusters() {
        return this.results.num_clusters();
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return An `Int32Array` (or a view thereof) containing the cluster assignment for each cell.
     */
    clusters({ copy = true } = {}) {
        return utils.possibleCopy(this.results.clusters(), copy);
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return An `Int32Array` (or a view thereof) containing the number of cells in each cluster.
     */
    clusterSizes({ copy = true } = {}) {
        return utils.possibleCopy(this.results.cluster_sizes(), copy);
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) containing the within-cluster sum of squares in each cluster.
     */
    withinClusterSumSquares({ copy = true } = {}) {
        return utils.possibleCopy(this.results.wcss(), copy);
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {boolean} [options.copy] - Whether to copy the results from the Wasm heap.
     * This incurs a copy but has safer lifetime management.
     *
     * @return A `Float64Array` (or a view thereof) containing the cluster centers in a column-major array,
     * where rows are dimensions and columns are the clusters.
     */
    clusterCenters({ copy = true } = {}) {
        return utils.possibleCopy(this.results.centers(), copy);
    }

    /**
     * @return Number of refinement iterations performed by the algorithm.
     */
    iterations() {
        return this.results.iterations();
    }

    /**
     * @return Status of the algorithm - anything other than zero usually indicates a problem with convergence.
     */
    status() {
        return this.results.status();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.results !== null) {
            this.results.delete();
            this.results = null;
        }
        return;
    }
}

/**
 * Cluster cells using k-means.
 *
* @param {(PCAResults|Float64WasmArray|Array|TypedArray)} x - Numeric coordinates of each cell in the dataset.
 * For array inputs, this is expected to be in column-major format where the rows are the variables and the columns are the cells.
 * For a `PCAResults` input, we extract the principal components.
 * @param clusters Number of clusters to create.
 * This should not be greater than the number of cells.
 * @param {Object} [options] - Optional parameters.
 * @param {number} [options.numberOfDims] - Number of variables/dimensions per cell.
 * Only used (and required) for array-like `x`.
 * @param {number} [options.numberOfCells] - Number of cells.
 * Only used (and required) for array-like `x`.
 * @param {string} [options.initMethod] - Initialization method.
 * Setting `"random"` will randomly select `clusters` cells as centers.
 * Setting `"kmeans++"` will use the weighted sampling approach of Arthur and Vassilvitskii (2007).
 * Setting `"pca-part"` will use PCA partitioning.
 * @param {number} [options.initSeed] - Seed to use for random number generation during initialization.
 * @param {number} [options.initPCASizeAdjust] - Adjustment factor for the cluster sizes, used when `initMethod = "pca-part"`.
 * Larger values (up to 1) will prioritize partitioning of clusters with more cells.
 *
 * @return A `KmeansClusters` object containing the clustering results.
 */
export function clusterKmeans(x, clusters, { numberOfDims = null, numberOfCells = null, initMethod = "pca-part", initSeed = 5768, initPCASizeAdjust = 1 } = {}) {
    var buffer;
    var raw;
    var output;

    const init_choices = ["random", "kmeans++", "pca-part"]
    let init_chosen = init_choices.indexOf(initMethod);
    if (init_chosen == -1) {
        throw new Error("'initMethod' should be one of 'random', 'kmeans++' or 'pca-part'");
    }

    try {
        let pptr;

        if (x instanceof PCAResults) {
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

        raw = wasm.call(module => module.cluster_kmeans(pptr, numberOfDims, numberOfCells, clusters, init_chosen, initSeed, initPCASizeAdjust));
        output = new KmeansClusters(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(buffer);
    }

    return output;
}
