import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { buildNeighborSearchIndex, BuildNeighborSearchIndexResults } from "./findNearestNeighbors.js"; 

/**
 * Scale embeddings based on the variation between neighboring cells.
 * This aims to equalize the noise across embeddings for the same population of cells across different data modalities,
 * allowing them to be combined into a single embedding for coordinated downstream analyses.
 * Check out the [**mumosa**](https://github.com/libscran/mumosa) documentation for more details.
 *
 * @param {Array} embeddings - Array of Float64WasmArrays containing column-major matrices where rows are dimensions and columns are cells.
 * All entries of this array should contain data for the same number and ordering of cells.
 * @param {number} numberOfCells - Number of cells in all embeddings.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.neighbors=20] - Number of neighbors to use for quantifying variation.
 * Larger values provide a more stable calculation but assume larger subpopulations.
 * @param {?Array} [options.indices=null] - Array of {@linkplain BuildNeighborSearchIndexResults} objects, 
 * where each entry is constructed from the corresponding entry of `embeddings` (see {@linkcode buildNeighborSearchIndex}).
 * This can be used to avoid redundant calculation of indices if they are already available.
 * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
 * If `false`, a Float64WasmArray is returned instead.
 * @param {?Float64WasmArray} [options.buffer=null] - Array in which to store the combined embedding.
 * This should have length equal to the product of `numberOfCells` and the sum of dimensions of all embeddings.
 * @param {boolean} [options.approximate=true] - Should we construct an approximate search index if `indices` is not supplied?
 * @param {?(Array|TypedArray|Float64WasmArray)} [options.weights=null] - Array of length equal to the number of embeddings, containing a non-enegative relative weight for each embedding.
 * This is used to scale each embedding if non-equal noise is desired in the combined embedding.
 * If `null`, all embeddings receive the same weight.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {Float64Array|Float64WasmArray} Array containing the combined embeddings in column-major format, i.e., dimensions in rows and cells in columns.
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function scaleByNeighbors(embeddings, numberOfCells, { neighbors = 20, indices = null, asTypedArray = true, buffer = null, approximate = true, weights = null, numberOfThreads = null } = {}) {
    let embed_ptrs;
    let index_ptrs;
    let holding_weights;
    let local_buffer = null;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        let nembed = embeddings.length;
        embed_ptrs = utils.createBigUint64WasmArray(nembed);
        let embed_arr = embed_ptrs.array();
        for (var i = 0; i < nembed; i++) {
            embed_arr[i] = BigInt(embeddings[i].offset);
        }

        let ndims = [];
        let total_ndim = 0;
        for (var i = 0; i < nembed; i++) {
            let n = embeddings[i].length;
            let ND = Math.floor(n / numberOfCells);
            if (numberOfCells * ND !== n) {
                throw new Error("length of arrays in 'embeddings' should be a multiple of 'numberOfCells'");
            }
            ndims.push(ND);
            total_ndim += ND;
        }

        if (indices === null) {
            indices = [];
            for (var i = 0; i < nembed; i++) {
                indices.push(buildNeighborSearchIndex(embeddings[i], { numberOfDims: ndims[i], numberOfCells: numberOfCells, approximate: approximate }));
            }
        } else {
            if (nembed !== indices.length) {
                throw new Error("'indices' and 'embeddings' should have the same length");
            }
            for (var i = 0; i < nembed; i++) {
                let index = indices[i];
                if (numberOfCells != index.numberOfCells()) {
                    throw new Error("each element of 'indices' should have the same number of cells as 'numberOfCells'");
                }
                if (ndims[i] != index.numberOfDims()) {
                    throw new Error("each element of 'indices' should have the same number of dimensions as its embedding in 'embeddings'");
                }
            }
        }

        let weight_offset = 0;
        let use_weights = false;
        if (weights !== null) {
            use_weights = true;
            holding_weights = utils.wasmifyArray(weights, "Float64WasmArray");
            if (holding_weights.length != nembed) {
                throw new Error("length of 'weights' should be equal to the number of embeddings");
            }
            weight_offset = holding_weights.offset;
        }

        index_ptrs = utils.createBigUint64WasmArray(nembed);
        let index_arr = index_ptrs.array();
        for (var i = 0; i < nembed; i++) {
            let index = indices[i];
            index_arr[i] = BigInt(indices[i].index.$$.ptr);
        }

        let total_len = total_ndim * numberOfCells;
        if (buffer === null) {
            local_buffer = utils.createFloat64WasmArray(total_len);
            buffer = local_buffer;
        } else if (total_len !== buffer.length) {
            throw new Error("length of 'buffer' should be equal to the product of 'numberOfCells' and the total number of dimensions");
        }

        wasm.call(module => module.scale_by_neighbors(
            numberOfCells, 
            nembed, 
            embed_ptrs.offset, 
            index_ptrs.offset, 
            buffer.offset, 
            neighbors, 
            use_weights, 
            weight_offset,
            nthreads
        ));

    } catch (e) {
        utils.free(local_buffer);
        throw e;

    } finally {
        utils.free(embed_ptrs);
        utils.free(index_ptrs);
        utils.free(holding_weights);
    }

    return utils.toTypedArray(buffer, local_buffer == null, asTypedArray);
}
