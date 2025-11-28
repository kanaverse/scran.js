import * as utils from "./utils.js";
import { RunPcaResults } from "./runPca.js";
import * as wasm from "./wasm.js";

/**
 * Perform mutual nearest neighbor (MNN) correction on a low-dimensional representation to remo
 * This is used to remove batch effects prior to downstream analyses like clustering,
 * check out the [**mnncorrect**](https://github.com/libscran/mnncorrect) for details.
 *
 * @param {(RunPcaResults|TypedArray|Array|Float64WasmArray)} x - A matrix of low-dimensional results where rows are dimensions and columns are cells.
 * If this is a {@linkplain RunPcaResults} object, the PCs are automatically extracted.
 * Otherwise, the matrix should be provided as an array in column-major form, with specification of `numberOfDims` and `numberOfCells`.
 * @param {(Int32WasmArray|Array|TypedArray)} block - Array containing the block assignment for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of blocks.
 * This is used to segregate cells in order to perform normalization within each block.
 * @param {object} [options={}] - Further optional parameters.
 * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
 * If `false`, a Float64WasmArray is returned instead.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer of length equal to the product of the number of cells and dimensions,
 * to be used to store the corrected coordinates for each cell.
 * If `null`, this is allocated and returned by the function.
 * @param {?number} [options.numberOfDims=null] - Number of dimensions in `x`.
 * This should be specified if an array-like object is provided, otherwise it is ignored.
 * @param {?number} [options.numberOfCells=null] - Number of cells in `x`.
 * This should be specified if an array-like object is provided, otherwise it is ignored.
 * @param {number} [options.k=15] - Number of neighbors to use in the MNN search. 
 * @param {number} [options.steps=1] - Number of steps to take in the nearest neighbor graph when computing the center of mass for each cell in an MNN pair.
 * @param {string} [options.mergePolicy="rss"] - What policy to use for ordering the batches to be merged.
 * Options are to use the size (`"size"`), the variance (`"variance"`), the residual sum of squares (`"rss"`) or the input order (`"input"`).
 * @param {boolean} [options.approximate=true] - Whether to perform an approximate nearest neighbor search.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {Float64Array|Float64WasmArray} Array of length equal to `x`, containing the batch-corrected low-dimensional coordinates for all cells.
 * Corrected values are organized using the column-major layout, where rows are dimensions and columns are cells.
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function mnnCorrect(x, block, options = {}) {
    let { 
        asTypedArray = true,
        buffer = null, 
        numberOfDims = null,
        numberOfCells = null,
        k = 15,
        steps = 1,
        numberOfMADs = 3, // back-compatibility
        robustIterations = null,  // back-compatibility
        robustTrim = null, // back-compatibility
        referencePolicy = null, // back-compatibility
        mergePolicy = "rss",
        approximate = true,
        numberOfThreads = null,
        ...others
    } = options;
    utils.checkOtherOptions(others);

    let local_buffer = null;
    let x_data;
    let block_data;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    if (referencePolicy !== null) {
        console.warning("'referencePolicy=' is deprecated, use 'mergePolicy' instead");
        mergePolicy = referencePolicy.replace(/^max-/, "");
    }

    try {
        if (x instanceof RunPcaResults) {
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
            steps,
            mergePolicy,
            approximate,
            nthreads
        ));

    } catch (e) {
        utils.free(local_buffer);
        throw e;
        
    } finally {
        utils.free(x_data);
    }

    return utils.toTypedArray(buffer, local_buffer == null, asTypedArray);
}
