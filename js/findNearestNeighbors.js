import * as utils from "./utils.js";
import * as gc from "./gc.js";
import { RunPcaResults } from "./runPca.js";

/** 
 * Wrapper for the neighbor search index on the Wasm heap, typically produced by {@linkcode buildNeighborSearchIndex}.
 * @hideconstructor
 */
export class BuildNeighborSearchIndexResults {
    #id;
    #index; 

    constructor(id, raw) {
        this.#id = id;
        this.#index = raw;
        return;
    }

    /**
     * @return {number} Number of cells in the index.
     */
    numberOfCells() {
        return this.#index.num_obs();
    }

    /**
     * @return {number} Number of dimensions in the index.
     */
    numberOfDims() {
        return this.#index.num_dim();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#index !== null) {
            gc.release(this.#id);
            this.#index = null;
        }
        return;
    }

    // Internal only, not documented.
    get index() {
        return this.#index;
    }
}

/**
 * Build the nearest neighbor search index.
 *
 * @param {(RunPcaResults|Float64WasmArray|Array|TypedArray)} x - Numeric coordinates of each cell in the dataset.
 * For array inputs, this is expected to be in column-major format where the rows are the variables and the columns are the cells.
 * For a {@linkplain RunPcaResults} input, we extract the principal components.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfDims=null] - Number of variables/dimensions per cell.
 * Only used (and required) for array-like `x`.
 * @param {?number} [options.numberOfCells=null] - Number of cells.
 * Only used (and required) for array-like `x`.
 * @param {boolean} [options.approximate=true] - Whether to build an index for an approximate neighbor search.
 *
 * @return {BuildNeighborSearchIndexResults} Index object to use for neighbor searches.
 */
export function buildNeighborSearchIndex(x, options = {}) {
    let { numberOfDims = null, numberOfCells = null, approximate = true, ...others } = options;
    utils.checkOtherOptions(others);
    var buffer;
    var output;

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
            module => module.build_neighbor_index(pptr, numberOfDims, numberOfCells, approximate),
            BuildNeighborSearchIndexResults
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(buffer);
    }

    return output;
}

/** 
 * Wrapper for the neighbor search results on the Wasm heap, typically produced by {@linkcode findNearestNeighbors}.
 * @hideconstructor
 */
export class FindNearestNeighborsResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?number} [options.truncate=null] - Maximum number of neighbors to count for each cell.
     * If `null` or greater than the number of available neighbors, all neighbors are counted.
     * @return {number} The total number of neighbors across all cells.
     * This is usually the product of the number of neighbors and the number of cells.
     */
    size(options = {}) {
        const { truncate = null, ...others } = options;
        utils.checkOtherOptions(others);
        return this.#results.size(FindNearestNeighborsResults.#numberToTruncate(truncate));
    }

    /**
     * @return {number} The number of cells used in the search.
     */
    numberOfCells() {
        return this.#results.num_obs();
    }

    // Internal use only, not documented.
    get results() {
        return this.#results;
    }

    static #numberToTruncate(truncate) {
        return (truncate === null ? -1 : truncate);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {?Int32WasmArray} [options.runs=null] - A Wasm-allocated array of length equal to {@linkcode FindNearestNeighborsResults#numberOfCells numberOfCells},
     * to be used to store the number of neighbors per cell.
     * @param {?Int32WasmArray} [options.indices=null] - A Wasm-allocated array of length equal to {@linkcode FindNearestNeighborsResults#size size},
     * to be used to store the indices of the neighbors of each cell.
     * @param {?Float64WasmArray} [options.distances=null] - A Wasm-allocated array of length equal to {@linkcode FindNearestNeighborsResults#size size},
     * to be used to store the distances to the neighbors of each cell.
     * @param {?number} [options.truncate=null] - Maximum number of nearest neighbors to serialize for each cell.
     * If `null` or greater than the number of available neighbors, all neighbors are used.
     *
     * @return {object} 
     * An object is returned with the `runs`, `indices` and `distances` keys, each with an appropriate TypedArray as the value.
     *
     * If all of the arguments are non-`null`, the TypedArrays in the returned object are views on the corresponding input WasmArrays.
     * Note that these views may be invalidated on the next allocation on the Wasm heap.
     *
     * If only some of the arguments are non-`null`, an error is raised.
     */
    serialize(options = {}) {
        const { runs = null, indices = null, distances = null, truncate = null, ...others } = options;
        utils.checkOtherOptions(others);

        var copy = (runs === null) + (indices === null) + (distances === null);
        if (copy != 3 && copy != 0) {
            throw new Error("either all or none of 'runs', 'indices' and 'distances' can be 'null'");
        }

        let nkeep = FindNearestNeighborsResults.#numberToTruncate(truncate);
        var output;

        if (copy === 3) {
            var run_data;
            var ind_data;
            var dist_data;
            
            try {
                run_data = utils.createInt32WasmArray(this.numberOfCells());
                let s = this.#results.size(nkeep);
                ind_data = utils.createInt32WasmArray(s);
                dist_data = utils.createFloat64WasmArray(s);
                this.#results.serialize(run_data.offset, ind_data.offset, dist_data.offset, nkeep);

                output = { 
                    "runs": run_data.slice(), 
                    "indices": ind_data.slice(), 
                    "distances": dist_data.slice() 
                };
            } finally {
                utils.free(run_data);
                utils.free(ind_data);
                utils.free(dist_data);
            }

        } else {
            this.#results.serialize(runs.offset, indices.offset, distances.offset, nkeep);
            output = {
                "runs": runs.array(),
                "indices": indices.array(),
                "distances": distances.array()
            };
        }

        return output;
    }

    /**
     * @param {Int32WasmArray|Array|TypedArray} runs An array of length equal to {@linkcode FindNearestNeighborsResults#numberOfCells numberOfCells},
     * containing the number of neighbors per cell.
     * @param {Int32WasmArray|Array|TypedArray} indices An array of length equal to {@linkcode FindNearestNeighborsResults#size size},
     * containing the indices of the neighbors of each cell.
     * @param {Float64WasmArray|Array|TypedArray} indices An array of length equal to {@linkcode FindNearestNeighborsResults#size size},
     * containing the distances to the neighbors of each cell.
     *
     * @return {FindNearestNeighborsResults} Object containing the unserialized search results.
     */
    static unserialize(runs, indices, distances) {
        var output;
        var run_data;
        var ind_data;
        var dist_data;

        try {
            run_data = utils.wasmifyArray(runs, "Int32WasmArray");
            ind_data = utils.wasmifyArray(indices, "Int32WasmArray");
            dist_data = utils.wasmifyArray(distances, "Float64WasmArray");
            output = gc.call(
                module => new module.NeighborResults(runs.length, run_data.offset, ind_data.offset, dist_data.offset),
                FindNearestNeighborsResults
            );

        } catch (e) {
            utils.free(output);
            throw e;

        } finally { 
            utils.free(run_data);
            utils.free(ind_data);
            utils.free(dist_data);
        }

        return output;
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
 * Find the nearest neighbors for each cell.
 *
 * @param {NeighborSearchIndex} x The neighbor search index built by {@linkcode buildNeighborSearchIndex}.
 * @param {number} k Number of neighbors to find.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {FindNearestNeighborsResults} Object containing the search results.
 */
export function findNearestNeighbors(x, k, options = {}) {
    const { numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);
    return gc.call(
        module => module.find_nearest_neighbors(x.index, k, nthreads),
        FindNearestNeighborsResults
    );
}

/**
 * Truncate existing neighbor search results to the `k` nearest neighbors for each cell.
 * This is exactly or approximately equal to calling {@linkcode findNearestNeighbors} with the new `k`,
 * depending on whether `approximate = false` or `approximate = true` was used to build the search index, respectively.
 *
 * @param {FindNearestNeighborsResults} x Existing neighbor search results from {@linkcode findNearestNeighbors}.
 * @param {number} k Number of neighbors to retain.
 * If this is larger than the number of available neighbors, all neighbors are retained.
 *
 * @return {FindNearestNeighborsResults} Object containing the truncated search results.
 */
export function truncateNearestNeighbors(x, k) {
    return gc.call(
        module => module.truncate_nearest_neighbors(x.results, k),
        FindNearestNeighborsResults
    );
}
