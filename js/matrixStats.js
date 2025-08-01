import * as utils from "./utils.js";
import * as wasm from "./wasm.js";

function matrix_sums(x, row, options = {}) {
    let { asTypedArray = true, buffer = null, numberOfThreads = 1, ...others } = options;
    utils.checkOtherOptions(others);

    let local_buffer = null;
    let dim = (row ? x.numberOfRows() : x.numberOfColumns());

    try {
        if (buffer === null) {
            local_buffer = utils.createFloat64WasmArray(dim);
            buffer = local_buffer;
        } else if (buffer.length != dim) {
            throw new Error("'buffer' should have length equal to the number of " + (row ? "rows" : "columns"));
        }
        wasm.call(module => module.matrix_sums(x.matrix, row, buffer.offset, numberOfThreads));

    } catch(e) {
        utils.free(local_buffer);
        throw e;
    }

    return utils.toTypedArray(buffer, local_buffer == null, asTypedArray);
}

/**
 * Compute the row sums of a {@link ScranMatrix}.
 *
 * @param {ScranMatrix} x - A matrix.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
 * If `false`, a Float64WasmArray is returned instead.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output size factors.
 * Length should be equal to that of the number of rows of `x`.
 * If `null`, an array is allocated by the function.
 * @param {number} [options.numberOfThreads=1] - Number of threads to use for the calculation.
 *
 * @return {Float64Array|Float64WasmArray} Array containing the row sums.
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function rowSums(x, options = {}) {
    return matrix_sums(x, true, options);
}

/**
 * Compute the column sums of a {@link ScranMatrix}.
 *
 * @param {ScranMatrix} x - A matrix.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
 * If `false`, a Float64WasmArray is returned instead.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output size factors.
 * Length should be equal to that of the number of columns of `x`.
 * If `null`, an array is allocated by the function.
 * @param {number} [options.numberOfThreads=1] - Number of threads to use for the calculation.
 *
 * @return {Float64Array|Float64WasmArray} Array containing the column sums.
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function columnSums(x, options = {}) {
    return matrix_sums(x, false, options);
}
