import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { buildNeighborSearchIndex, NeighborSearchIndex } from "./findNearestNeighbors.js"; 

/**
 * Scale embeddings based on the variation between neighboring cells.
 * This aims to equalize the noise across embeddings for the same population of cells across different data modalities,
 * allowing them to be combined into a single embedding for coordinated downstream analyses.
 *
 * @param {Array} embeddings - Array of Float64WasmArrays containing column-major matrices where rows are dimensions and columns are cells.
 * All entries of this array should contain data for the same number and ordering of cells.
 * @param {number} numberOfCells - Number of cells in all embeddings.
 * @param {Object} options - Optional parameters.
 * @param {number} options.neighbors - Number of neighbors to use for quantifying variation.
 * Larger values provide a more stable calculation but assume larger subpopulations.
 * @param {?Array} options.indices - Array of {@linkplain NeighborSearchIndex} objects, 
 * where each entry is constructed from the corresponding entry of `embeddings` (see {@linkcode buildNeighborSearchIndex}).
 * This can be used to avoid redundant calculation of indices if they are already available.
 * @param {?Float64WasmArray} options.buffer - Array in which to store the combined embedding.
 * This should have length equal to the product of `numberOfCells` and the sum of dimensions of all embeddings.
 * @param {boolean} options.approximate - Should we construct an approximate search index if `indices` is not supplied?
 *
 * @return {Float64WasmArray} Array containing the combined embeddings in column-major format, i.e., dimensions in rows and cells in columns.
 * If `buffer` was supplied, a reference to it is returned; otherwise a new array is allocated.
 */
export function scaleByNeighbors(embeddings, numberOfCells, { neighbors = 20, indices = null, buffer = null, approximate = true } = {}) {
    let nembed = embeddings.length;
    let embed_ptrs, index_ptrs;
    let holding;

    let deletable = [];
    try {
        // Making sure that everyone has indices.
        if (indices == null) {
            for (var i = 0; i < nembed; i++) {
                let ndim = embeddings[i].length / numberOfCells;
                let index = buildNeighborSearchIndex(embeddings[i], { numberOfCells: numberOfCells, numberOfDims: ndim, approximate: approximate });
                deletable.push(index);
            }
            indices = deletable;
        } else {
            if (nembed !== indices.length) {
                throw new Error("'indices' and 'embeddings' should have the same length");
            }
            for (var i = 0; i < nembed; i++) {
                let index = indices[i];
                if (numberOfCells != index.numberOfCells()) {
                    throw new Error("each element of 'indices' should have the same number of cells as 'numberOfCells'");
                }
                if (embeddings[i].length != index.numberOfCells() * index.numberOfDims()) {
                    throw new Error("length of arrays in 'embeddings' should equal the length of arrays used to build 'indices'");
                }
            }
        }

        // Fetching the pointers.
        embed_ptrs = utils.createBigUint64WasmArray(nembed);
        let embed_arr = embed_ptrs.array();
        for (var i = 0; i < nembed; i++) {
            embed_arr[i] = BigInt(embeddings[i].offset);
        }

        index_ptrs = utils.createBigUint64WasmArray(nembed);
        let index_arr = index_ptrs.array();
        let total_ndim = 0;
        for (var i = 0; i < nembed; i++) {
            index_arr[i] = BigInt(indices[i].index.$$.ptr);
            total_ndim += indices[i].numberOfDims();
        }

        // Allocating output space, if necessary; and then scaling.
        if (buffer === null) {
            holding = utils.createFloat64WasmArray(total_ndim * numberOfCells);
            buffer = holding;
        }
        wasm.call(module => module.scale_by_neighbors(numberOfCells, nembed, embed_ptrs.offset, index_ptrs.offset, buffer.offset, neighbors)); 

    } catch (e) {
        utils.free(holding);
        throw e;

    } finally {
        for (const x of deletable) {
            x.free();
        }
        utils.free(embed_ptrs);
        utils.free(index_ptrs);
    }

    return buffer;
}
