import * as utils from "./utils.js";
import * as wasm from "./wasm.js";

/**
 * Transpose a matrix that is stored as a contiguous TypedArray.
 *
 * @param {number} numberOfRows - Number of rows in the matrix.
 * @param {number} numberOfColumns - Number of columns in the matrix.
 * @param {WasmArray|Array|TypedArray} values - Values of all elements in the matrix.
 * This should have length equal to the product of `numberOfRows` and `numberOfColumns`.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.columnMajor=true] - Whether `values` contains the matrix in a column-major order.
 * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
 * If `false`, a Float64WasmArray is returned instead.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output size factors.
 * Length should be equal to that of `values`.
 * If `null`, an array is allocated by the function.
 *
 * @return {Float64Array|Float64WasmArray} Array containing the transposed contents of `values`.
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function transposeMatrix(numberOfRows, numberOfColumns, values, options = {}) {
    let { columnMajor = true, asTypedArray = true, buffer = null, ...others } = options;
    utils.checkOtherOptions(others);

    let local_buffer = null;
    let input_buffer = null;
    if (values.length !== numberOfRows * numberOfColumns) {
        throw new Error("'buffer' should have length equal to the product of 'numberOfRows' and 'numberOfColumns'");
    }

    try {
        if (buffer === null) {
            local_buffer = utils.createFloat64WasmArray(values.length);
            buffer = local_buffer;
        } else if (buffer.length != values.length) {
            throw new Error("'buffer' should have length equal to the product of 'numberOfRows' and 'numberOfColumns'");
        }

        input_buffer = utils.wasmifyArray(values, "Float64WasmArray");
        wasm.call(module => module.transpose_matrix(numberOfRows, numberOfColumns, input_buffer.offset, columnMajor, buffer.offset));

    } catch(e) {
        utils.free(local_buffer);
        throw e;
    } finally {
        utils.free(input_buffer);
    }

    return utils.toTypedArray(buffer, local_buffer == null, asTypedArray);
}
