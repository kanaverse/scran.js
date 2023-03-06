import * as wa from "wasmarrays.js";
import * as utils from "./utils.js";

/**
 * Convert an arbitrary array into a R-style factor, with integer indices into an array of levels.
 * This is useful for formatting grouping or blocking vectors for {@linkcode scoreMarkers}, {@linkcode modelGeneVar}, etc.
 *
 * @param {Array|TypedArray} x - Array of values to be converted into a factor.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.asWasmArray=true] - Whether to return an Int32WasmArray instance for the indices.
 * If `false`, an Int32Array is returned instead.
 * Only used if `buffer` is not supplied.
 * @param {?(Int32WasmArray|Int32Array)} [options.buffer=null] - Array in which the output is to be stored.
 * If provided, this should be of length equal to that of `x`.
 * @param {string} [options.action="warn"] - Action to take when invalid values (i.e., null, NaNs) are detected in `x`.
 *
 * - `"none"`: the index is silently set to `placeholder`.
 * - `"warn"`: a warning is raised on the first occurrence of an invalid value, and the index is set to `placeholder`.
 * - `"error"`: an error is raised.
 * 
 * @param {number} [options.placeholder=-1] - Placeholder index to use upon detecting invalid values in `x`.
 *
 * @return {object} Object containing:
 *
 * - `ids`: an Int32WasmArray or Int32Array of length equal to `x`, containing the index into `levels` for each cell.
 * - `levels`: an array of unique levels, such that `Array.from(ids).map(i => levels[i])` returns the same contents as `x` (aside from invalid values).
 *
 * If `buffer` was supplied, it is used as the value of the `ids` property.
 */
export function factorize(x, { asWasmArray = true, buffer = null, action = "error", placeholder = -1 } = {}) {
    let levels = [];
    let local_buffer;

    let failure;
    if (action == "warn") {
        let warned = false;
        failure = () => {
            if (warned) {
                console.warn ("replacing invalid values with the placeholder index '" + String(placeholder) + "'");
                warned = true;
            }
        };
    } else if (action == "none") {
        failure = () => {};
    } else if (action == "error") {
        failure = () => {
            throw new Error("detected invalid value (e.g., null, NaN) in 'x'");
        };
    } else {
        throw new Error("unknown action '" + action + "' for handling invalid entries");
    }

    try {
        if (buffer == null) {
            local_buffer = (asWasmArray ? utils.createInt32WasmArray(x.length) : new Int32Array(x.length));
            buffer = local_buffer;
        } else {
            if (buffer.length !== x.length) {
                throw new Error("'buffer' should have length equal to that of 'x'");
            }
            asWasmArray = buffer instanceof wa.Int32WasmArray;
        }

        let barr = (asWasmArray ? buffer.array() : buffer); // no allocations from this point onwards!
        let mapping = new Map;

        for (var i = 0; i < x.length; i++) {
            let y = x[i];
            if (y == null || (typeof y == "number" && !Number.isFinite(y))) {
                failure();
                barr[i] = placeholder;
                continue;
            }

            let existing = mapping.get(y);
            if (typeof existing == "undefined") {
                let n = levels.length;
                mapping.set(y, n);
                levels.push(y);
                barr[i] = n;
            } else {
                barr[i] = existing;
            }
        }

    } catch (e) {
        utils.free(local_buffer);
        throw e;
    }

    return {
        ids: buffer,
        levels: levels
    };
}


