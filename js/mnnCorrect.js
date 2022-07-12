import * as utils from "./utils.js";
import * as pca from "./runPCA.js";
import * as wasm from "./wasm.js";

/**
 * Perform mutual nearest neighbor (MNN) correction on a low-dimensional representation.
 * This is primarily used to remove batch effects.
 *
 * @param {(RunPCAResults|TypedArray|Array|Float64WasmArray)} x - A matrix of low-dimensional results where rows are dimensions and columns are cells.
 * If this is a {@linkplain RunPCAResults} object, the PCs are automatically extracted.
 * Otherwise, the matrix should be provided as an array in column-major form, with specification of `numberOfDims` and `numberOfCells`.
 * @param {(Int32WasmArray|Array|TypedArray)} block - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to perform normalization within each block.
 * @param {object} [options] - Further optional parameters.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer of length equal to the product of the number of cells and dimensions,
 * to be used to store the corrected coordinates for each cell.
 * If `null`, this is allocated and returned by the function.
 * @param {?number} [options.numberOfDims=null] - Number of dimensions in `x`.
 * This should be specified if an array-like object is provided, otherwise it is ignored.
 * @param {?number} [options.numberOfCells=null] - Number of cells in `x`.
 * This should be specified if an array-like object is provided, otherwise it is ignored.
 * @param {number} [options.k=15] - Number of neighbors to use in the MNN search. 
 * @param {number} [options.numberOfMADs=3] - Number of MADs to use to define the threshold on the distances to the neighbors,
 * see comments [here](https://ltla.github.io/CppMnnCorrect).
 * @param {number} [options.robustIterations=2] - Number of robustness iterations to use for computing the center of mass,
 * see comments [here](https://ltla.github.io/CppMnnCorrect).
 * @param {number} [options.robustTrim=0.25] - Proportion of furthest observations to remove during robustness iterations, 
 * see comments [here](https://ltla.github.io/CppMnnCorrect).
 * @param {string} [options.referencePolicy="max-size"] - What policy to use to choose the first reference batch.
 * This can be the largest batch (`"max-size"`), the most variable batch (`"max-variance"`), the batch with the highest RSS (`"max-rss"`) or batch 0 in `block` (`"input"`).
 * @param {boolean} [options.approximate=true] - Whether to perform an approximate nearest neighbor search.
 *
 * @return {Float64WasmArray} Array of length equal to `x`, containing the batch-corrected low-dimensional coordinates for all cells.
 * Values are organized using the column-major layout.
 * This is equal to `buffer` if provided.
 */
export function mnnCorrect(x, block, { 
    buffer = null, 
    numberOfDims = null,
    numberOfCells = null,
    k = 15,
    numberOfMADs = 3, 
    robustIterations = 2, 
    robustTrim = 0.25,
    referencePolicy = "max-size",
    approximate = true
} = {}) {

    let local_buffer;
    let x_data;
    let block_data;

    try {
        if (x instanceof pca.RunPCAResults) {
            numberOfDims = x.numberOfPCs();
            numberOfCells = x.numberOfCells();
            x = x.principalComponents({ copy: "view" });
        } else {
            if (numberOfDims === null || numberOfCells === null || numberOfDims * numberOfCells !== x.length) {
                throw new Error("length of 'x' must be equal to the product of 'numberOfDims' and 'numberOfCells'");
            }
            x_data = utils.wasmifyArray(x, "Float64WasmArray");
            x = x_data;
        }

        if (buffer == null) {
            local_buffer = utils.createFloat64WasmArray(numberOfCells * numberOfDims);
            buffer = local_buffer;
        } else if (buffer.length !== x.length) {
            throw new Error("length of 'buffer' must be equal to the product of the number of dimensions and cells");
        }

        block_data = utils.wasmifyArray(block, "Int32WasmArray");
        if (block_data.length != numberOfCells) {
            throw new Error("'block' must be of length equal to the number of cells in 'x'");
        }

        wasm.call(module => module.mnn_correct(
            numberOfDims, 
            numberOfCells,
            x.offset,
            block_data.offset,
            buffer.offset,
            k,
            numberOfMADs,
            robustIterations,
            robustTrim,
            referencePolicy,
            approximate
        ));

    } catch (e) {
        utils.free(local_buffer);
        throw e;
        
    } finally {
        utils.free(x_data);
    }

    return buffer; 
}
