import * as utils from "./utils.js";
import Module from "./Module.js";
import { Int32WasmArray, Float64WasmArray } from "./WasmArray.js";

/** 
 * Wrapper for the neighbor search results on the Wasm heap.
 */
export class NeighborSearchResults {
    /**
     * @param {Object} raw Search results on the Wasm heap.
     *
     * Not to be called directly by developers;
     * use `findNearestNeighbors()` instead.
     */
    constructor(raw) {
        this.results = raw;
        return;
    }

    /**
     * @return The total number of neighbors across all cells.
     * This is usually the product of the number of neighbors and the number of cells.
     */
    size() {
        return this.results.size();
    }

    /**
     * @return The number of cells used in the search.
     */
    numberOfCells() {
        return this.results.num_obs();
    }

    /**
     * @param {?Int32WasmArray} runs An allocation of length equal to `numberOfCells()`,
     * to be used to store the number of neighbors per cell.
     * @param {?Int32WasmArray} indices An allocation of length equal to `size()`,
     * to be used to store the indices of the neighbors of each cell.
     * @param {?Float64WasmArray} indices An allocation of length equal to `size()`,
     * to be used to store the distances to the neighbors of each cell.
     *
     * @return 
     * If all of the arguments are non-`null`, the buffers in `runs`, `indices` and `distances` are filled with their respective contents.
     * If all of the arguments are `null`, a object is returned with `TypedArray` entries for each component.
     * Otherwise, an error is raised.
     */
    serialize(runs = null, indices = null, distances = null) {
        var copy = (runs === null) + (indices === null) + (distances === null);
        if (copy != 3 && copy != 0) {
            throw "either all or none of 'runs', 'indices' and 'distances' can be 'null'";
        }

        if (copy === 3) {
            var run_data;
            var ind_data;
            var dist_data;
            var output;
            
            try {
                run_data = new Int32WasmArray(this.numberOfCells());
                let s = this.size();
                ind_data = new Int32WasmArray(s);
                dist_data = new Float64WasmArray(s);
                this.results.serialize(run_data.offset, ind_data.offset, dist_data.offset);

                output = { 
                    "runs": run_data.clone(), 
                    "indices": ind_data.clone(), 
                    "distances": dist_data.clone() 
                };
            } finally {
                utils.free(run_data);
                utils.free(ind_data);
                utils.free(dist_data);
            }

            return output;
        } else {
            this.results.serialize(runs.offset, indices.offset, distances.offset);
        }
    }

    /**
     * @param {Int32WasmArray|Array|TypedArray} runs An array of length equal to `numberOfCells()`,
     * containing the number of neighbors per cell.
     * @param {Int32WasmArray|Array|TypedArray} indices An array of length equal to `size()`,
     * containing the indices of the neighbors of each cell.
     * @param {Float64WasmArray|Array|TypedArray} indices An array of length equal to `size()`,
     * containing the distances to the neighbors of each cell.
     *
     * @return A new `NeighborSearchResults` object containing the unserialized search results.
     */
    static unserialize(runs, indices, distances) {
        var raw;
        var output;
        var run_data;
        var ind_data;
        var dist_data;

        try {
            run_data = utils.wasmifyArray(runs, "Int32WasmArray");
            ind_data = utils.wasmifyArray(indices, "Int32WasmArray");
            dist_data = utils.wasmifyArray(distances, "Float64WasmArray");
            raw = utils.wrapModuleCall(() => new Module.NeighborResults(runs.length, run_data.offset, ind_data.offset, dist_data.offset));
            output = new NeighborSearchResults(raw);
        } catch (e) {
            utils.free(raw);
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
        this.results.delete();
        this.results = null;
        return;
    }
}

/**
 * Find the nearest neighbors for each cell.
 *
 * @param {NeighborSearchIndex} x The pre-build neighbor search index from `buildNeighborSearchIndex()`.
 * @param {number} k Number of neighbors to find.
 *
 * @return A `NeighborSearchResults` object containing the search results.
 */
export function findNearestNeighbors(x, k) {
    var raw;
    var output;

    try {
        raw = utils.wrapModuleCall(() => Module.find_nearest_neighbors(x.index, k));
        output = new NeighborSearchResults(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    }

    return output;
}
