import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";
import * as wa from "wasmarrays.js";

/**
 * Compute size factors to remove composition biases from ADT data using the [CLRm1 strategy](https://github.com/libscran/clrm1).
 *
 * @param {ScranMatrix} x The count matrix, usually after filtering.
 * @param {object} [options={}] - Optional parameters.
 * If `null`, this is automatically set to the row means of `x`.
 * @param {?Float64WasmArray} [options.buffer=null] - Output buffer for the size factors.
 * This should have length equal to the number of columns in `x`.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {Float64Array|Float64WasmArray} Array of length equal to the number of columns in `x`, containing the CLRm1 size factors for all cells.
 * Note that the factors are not centered and should be passed to {@linkcode centerSizeFactors} before calling {@linkcode normalizeCounts}.
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function computeClrm1Factors(x, options = {}) {
    let { asTypedArray = true, buffer = null, priorCount = 10, numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);
    var local_buffer = null;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        if (!(buffer instanceof wa.Float64WasmArray)) {
            local_buffer = utils.createFloat64WasmArray(x.numberOfColumns());
            buffer = local_buffer;
        } else if (buffer.length !== x.numberOfColumns()) {
            throw new Error("length of 'buffer' must be equal to the number of columns in 'x'");
        }

        wasm.call(module => module.compute_clrm1_factors(x.matrix, buffer.offset, nthreads));
    } catch (e) {
        utils.free(local_buffer);
        throw e;
    }
    
    return utils.toTypedArray(buffer, local_buffer == null, asTypedArray);
}
