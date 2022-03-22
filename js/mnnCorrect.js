import * as utils from "./utils.js";
import * as pca from "./pca.js";

/**
 * Perform mutual nearest neighbor correction on a low-dimensional representation.
 * This is primarily used to remove batch effects.
 *
 * @param {(PCAResults|TypedArray|Array|Float64WasmArray)} x - A matrix of low-dimensional results where rows are dimensions and columns are cells.
 * If this is a {@linkplain PCAResults} object, the PCs are automatically extracted.
 * Otherwise, the matrix should be provided as an array in column-major form, with specification of `numberOfDims` and `numberOfCells`.
 * @param {(Int32WasmArray|Array|TypedArray)} [options.block] - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to perform normalization within each block.
 * @param {object} [options] - Further optional parameters.
 * @param {?Float64WasmArray} [options.buffer] - Buffer of length equal to the product of the number of cells and dimensions,
 * to be used to store the corrected coordinates for each cell.
 * If `null`, this is allocated and returned by the function.
 * @param {?number} [options.numberOfDims] - Number of dimensions in `x`.
 * This should be specified if an array-like object is provided, otherwise it is ignored.
 * @param {?number} [options.numberOfCells] - Number of cells in `x`.
 * This should be specified if an array-like object is provided, otherwise it is ignored.
 * @param {number} [options.k] - Number of neighbors to use in the mutual nearest
 *
 */
export function mnnCorrect(x, block, { 
    buffer = null, 
    numberOfDims = null,
    numberOfCells = null,
    k = 15,
    numberOfMADs = 3, 
    robustIterations = 2, 
    robustTrim = 0.25,
    approximate = true
} = {}) {

    let x_data;
    let block_data;

    try {
        if (x instanceof pca.PCAResults) {
            numberOfDims = x.numberOfPCs();
            numberOfCells = x.numberOfCells();
            x = x.principalComponents({ copy: "view" });
        } else {
            if (numberOfDims === null || numberOfCells === null || numberOfDims * numberOfCells !== x.length) {
                throw "length of 'x' must be equal to the product of 'numberOfDims' and 'numberOfCells'";
            }
            x_data = utils.wasmifyArray(x, "Float64WasmArray");
            x = x_data;
        }

        if (buffer == null) {
            buffer = utils.createFloat64WasmArray(numberOfCells * numberOfDims);
        }

        block_data = utils.wasmifyArray(block, "Int32WasmArray");
        if (block_data.length != metrics.sums().length) {
            throw "'block' must be of length equal to the number of cells in 'metrics'";
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
            approximate
        ));
        
    } finally {
        utils.free(x_data);
    }

    return buffer;
}
