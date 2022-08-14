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
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.right=true] - Whether `value` is applied to the right of `x`.
 * Only relevant for subtraction or division.
 * @param {string} [options.along="row"] - Whether an array-like `value` maps to the rows (`"row"`) or columns (`"column"`).
 * If rows, `value` should have length equal to `x.numberOfRows()`.
 * If columns, `value` should have length equal to `x.numberOfColumns()`.
 * @param {boolean} [options.isReorganized=true] - Whether an array-like `value` has already been reorganized to match the row identities of `x` 
 * (see {@linkcode ScranMatrix#isReorganized ScranMatrix.isReorganized} for details).
 * Only relevant if `value` is array-like and `along = "row"`.
 * @param {boolean} [options.inPlace=false] - Whether to modify `x` in place.
 * If `false`, a new ScranMatrix is returned.
 *
 * @return {ScranMatrix} A ScranMatrix containing the delayed arithmetic operation on `x`.
 * If `inPlace = true`, this is a reference to `x`, otherwise it is a new ScranMatrix.
 */
export function delayedArithmetic(x, operation, value, { right = true, along = "row", isReorganized = true, inPlace = false } = {}) {
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

        let is_scalar = (typeof value == "number");
        if (!is_scalar) {
            vbuffer = utils.wasmifyArray(value, "Float64WasmArray")
        }

        let margin = (along == "row" ? 0 : 1);

        if (operation == "+") {
            if (is_scalar) {
                wasm.call(module => module.delayed_add_scalar(target.matrix, value));
            } else {
                wasm.call(module => module.delayed_add_vector(target.matrix, vbuffer.offset, vbuffer.length, margin, isReorganized));
            }
        } else if (operation == "*") {
            if (is_scalar) {
                wasm.call(module => module.delayed_multiply_scalar(target.matrix, value));
            } else {
                wasm.call(module => module.delayed_multiply_vector(target.matrix, vbuffer.offset, vbuffer.length, margin, isReorganized));
            }
        } else if (operation == "-") {
            if (is_scalar) {
                wasm.call(module => module.delayed_subtract_scalar(target.matrix, value, right));
            } else {
                wasm.call(module => module.delayed_subtract_vector(target.matrix, vbuffer.offset, vbuffer.length, margin, right, isReorganized));
            }
        } else if (operation == "/") {
            if (is_scalar) {
                wasm.call(module => module.delayed_divide_scalar(target.matrix, value, right));
            } else {
                wasm.call(module => module.delayed_divide_vector(target.matrix, vbuffer.offset, vbuffer.length, margin, right, isReorganized));
            }
        }

    } catch (e) {
        utils.free(xcopy);
        throw e;

    } finally {
        utils.free(vbuffer);
    }

    return target;
}
