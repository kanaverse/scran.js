import * as wa from "wasmarrays.js";
import * as utils from "./utils.js";

/**
 * Convert an arbitrary array into a R-style factor, with integer indices into an array of levels.
 * This is useful for formatting grouping or blocking vectors for {@linkcode scoreMarkers}, {@linkcode modelGeneVar}, etc.
 *
 * @param {Array|TypedArray} x - Array of values to be converted into a factor.
 * 
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
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
            if (!warned) {
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

/**
 * Reindex the factor indices to remove unused levels.
 * This is done by adjusting the indices such that every index from `[0, N)` is represented at least once, where `N` is the number of (used) levels.
 *
 * @param {Int32WasmArray|TypedArray|Array} x - Array of factor indices such as that produced by {@linkcode factorize}. 
 *
 * @return {Array} `x` is modified in place to remove unused levels.
 *
 * An array (denoted here as `y`) is returned that represents the mapping between the original and modified IDs,
 * i.e., running `x.map(i => y[i])` will recover the input `x`.
 * This is most commonly used to create a new array of levels, i.e., `y.map(i => old_levels[i])` will drop the unused levels. 
 */
export function dropUnusedLevels(x) {
    if (x instanceof wa.WasmArray) {
        // No more wasm allocations past this point!
        x = x.array();
    }

    let uniq = new Set(x);
    let uniq_arr = Array.from(uniq).sort();
    let mapping = {};
    uniq_arr.forEach((y, i) => { mapping[y] = i; });

    x.forEach((y, i) => {
        x[i] = mapping[y];
    });

    return uniq_arr;
}

/**
 * Subset a factor, possibly also dropping its unused levels.
 * This is typically based on the same filtering vector as {@linkcode filterCells}.
 *
 * @param {object} x - An object representing a factor, containing the following properties:
 *
 * - `ids`: An Int32Array or Int32WasmArray of integer indices.
 * - `levels`: An array of levels that can be indexed by entries of `ids`.
 *
 * This is typically produced by {@linkcode factorize}. 
 * @param {(Array|TypedArray|WasmArray)} subset - Array specifying the subset to retain or filter out, depending on `filter`.
 *
 * If `filter = null`, the array is expected to contain integer indices specifying the entries in `x` to retain.
 * The ordering of indices in `subset` will be respected in the subsetted array.
 *
 * If `filter = true`, the array should be of length equal to that of `x`.
 * Each value is interpreted as a boolean and, if truthy, indicates that the corresponding entry of `x` should be filtered out.
 *
 * If `filter = false`, the array should be of length equal to that of `x`.
 * Each value is interpreted as a boolean and, if truthy, indicates that the corresponding entry of `x` should be retained.
 *
 * Note that TypedArray views on Wasm-allocated buffers should only be provided if `buffer` is also provided;
 * otherwise, a Wasm memory allocation may invalidate the view.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.drop=true] - Whether to drop unused levels in the output, see {@linkcode dropUnusedLevels}.
 * @param {?boolean} [options.filter=null] - Whether to retain truthy or falsey values in a `subset` boolean filter.
 * If `null`, `subset` should instead contain the indices of elements to retain.
 * @param {?(Int32Array|Int32WasmArray)} [options.buffer=null] - Array in which the output is to be stored, of the same type as `x.ids`.
 * If provided, this should be of length equal to `subset`, if `filter = null`;
 * the number of truthy elements in `subset`, if `filter = false`;
 * or the number of falsey elements in `subset`, if `filter = true`.
 *
 * @return {object} An object like `x`, containing:
 *
 * - `ids`: An Int32Array or Int32WasmArray of integer indices, subsetted from those in `x.ids`.
 * - `levels`: Array of levels that can be indexed by entries of the output `ids`.
 *   If `drop = true`, this may be a subset of `x.levels` where every entry is represented at least once in the output `ids`.
 *
 * If `buffer` is supplied, the returned `ids` will be set to `buffer`.
 */
export function subsetFactor(x, subset, { drop = true, filter = null, buffer = null } = {}) {
    let output = { ids: null, levels: x.levels };

    if (x.ids instanceof wa.WasmArray) {
        output.ids = wa.subsetWasmArray(x.ids, subset, { filter, buffer });
    } else {
        let n = wa.checkSubsetLength(subset, filter, x.length, "x");
        if (buffer == null) {
            buffer = new x.ids.constructor(n);
        }
        wa.fillSubset(subset, filter, x.ids, buffer);
        output.ids = buffer;
    }

    if (drop) {
        let remapping = dropUnusedLevels(output.ids);
        output.levels = remapping.map(i => x.levels[i]);
    }
    return output;
}
