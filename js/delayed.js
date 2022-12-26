import * as utils from "./utils.js";
import * as wasm from "./wasm.js";

/**
 * Apply delayed arithmetic to a {@linkplain ScranMatrix} object.
 *
 * @param {ScranMatrix} x - A ScranMatrix object.
 * @param {string} operation - The operation to perform, one of `"+"`, `"*"`, `"/"` or `"-"`.
 * @param {number|Array|WasmArray|TypedArray} value - The other operand in the arithmetic operation.
 * If a scalar, this is applied element-wise to each entry of `x`.
 * If a vector, it is assumed to map to either the rows or columns of `x` (see `along`) and each entry is applied to all values of the corresponding row/column.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.right=true] - Whether `value` is applied to the right of `x`.
 * Only relevant for subtraction or division.
 * @param {string} [options.along="row"] - Whether an array-like `value` maps to the rows (`"row"`) or columns (`"column"`).
 * If rows, `value` should have length equal to `x.numberOfRows()`.
 * If columns, `value` should have length equal to `x.numberOfColumns()`.
 * @param {boolean} [options.inPlace=false] - Whether to modify `x` in place.
 * If `false`, a new ScranMatrix is returned.
 *
 * @return {ScranMatrix} A ScranMatrix containing the delayed arithmetic operation on `x`.
 * If `inPlace = true`, this is a reference to `x`, otherwise it is a new ScranMatrix.
 */
export function delayedArithmetic(x, operation, value, { right = true, along = "row", inPlace = false } = {}) {
    let xcopy;
    let vbuffer;
    let target;

    try {
        if (inPlace) {
            target = x;
        } else {
            xcopy = x.clone();
            target = xcopy;
        }

        let margin = (along == "row" ? 0 : 1);

        if (typeof value == "number") {
            wasm.call(module => module.delayed_arithmetic_scalar(target.matrix, operation, right, value));
        } else {
            vbuffer = utils.wasmifyArray(value, "Float64WasmArray")
            wasm.call(module => module.delayed_arithmetic_vector(target.matrix, operation, right, margin, vbuffer.offset, vbuffer.length));
        }

    } catch (e) {
        utils.free(xcopy);
        throw e;

    } finally {
        utils.free(vbuffer);
    }

    return target;
}

/**
 * Apply delayed math to a {@linkplain ScranMatrix} object.
 *
 * @param {ScranMatrix} x - A ScranMatrix object.
 * @param {string} operation - The operation to perform, one of `"log"`, `"sqrt"`, `"abs"`, `"log1p"`, `"round"` or `"exp"`.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.logBase=null] - Base of the logarithm to use when `operation = "log"`.
 * Defaults to the natural base.
 * @param {boolean} [options.inPlace=false] - Whether to modify `x` in place.
 * If `false`, a new ScranMatrix is returned.
 *
 * @return {ScranMatrix} A ScranMatrix containing the delayed math operation on `x`.
 * If `inPlace = true`, this is a reference to `x`, otherwise it is a new ScranMatrix.
 */
export function delayedMath(x, operation, { logBase = null, inPlace = false } = {}) {
    let xcopy;
    let target;

    try {
        if (inPlace) {
            target = x;
        } else {
            xcopy = x.clone();
            target = xcopy;
        }

        if (logBase === null) {
            logBase = -1;
        }

        wasm.call(module => module.delayed_math(target.matrix, operation, logBase));
    } catch (e) {
        utils.free(xcopy);
        throw e;
    }

    return target;
}

/**
 * Transpose a {@linkplain ScranMatrix} object.
 *
 * @param {ScranMatrix} x - A ScranMatrix object.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.inPlace=false] - Whether to modify `x` in place.
 * If `false`, a new ScranMatrix is returned.
 *
 * @return {ScranMatrix} A ScranMatrix containing the transposition of `x`.
 * If `inPlace = true`, this is a reference to `x`, otherwise it is a new ScranMatrix.
 */
export function transpose(x, { inPlace = false } = {}) {
    let xcopy;
    let target;

    try {
        if (inPlace) {
            target = x;
        } else {
            xcopy = x.clone();
            target = xcopy;
        }
        wasm.call(module => module.transpose(target.matrix));
    } catch (e) {
        utils.free(xcopy);
        throw e;
    }

    return target;
}
