import * as wa from "wasmarrays.js";

/**
 * Check that an array collection has equilength arrays.
 * Array collections are just objects where each value is an Array or TypedArray of the same length;
 * this is typically used to represent the per-gene or per-cell annotations.
 * 
 * @param {object} x - Object containing a collection of arrays (or TypedArrays) of the same length.
 * Currently WasmArrays are not supported.
 *
 * @return An error is raised if `x` has differing lengths or contains WasmArrays.
 */
export function validateArrayCollection(x) {
    let length = null;
    for (const [k, v] of Object.entries(x)) {
        if (length === null) {
            length = v.length;
        } else if (length !== v.length) {
            throw new Error("array collection should have equilength arrays");
        } else if (v instanceof wa.WasmArray) {
            throw new Error("array collection should not contain WasmArrays");
        }
    }
    return;
}

/**
 * Subset each array in a collection of equilength arrays.
 * This is typically performed on the per-cell annotations after filtering in {@linkcode filterCells};
 * on the per-gene annotations to match any row reorganization (see {@linkcode ScranMatrix#isReorganized isReorganized});
 * or on the per-gene annotations to match the features in the intersection of {@linkcode cbindWithNames}, to name a few.
 *
 * @param {object} x - Object containing arrays or TypedArrays, see {@linkcode validateArrayCollection}.
 * @param {Array|TypedArray|WasmArray} subset - Array of indices specifing the subset to extract from each array in `x`.
 *
 * Alternatively, an array of length equal to the length of arrays in `x`, specifying whether the corresponding value in each array should be retained.
 * @param {object} [options] - Optional parameters.
 * @param {?boolean} [options.filter] - Whether `subset` is a filtering vector.
 * - If `null`, `subset` is assumed to contain indices of the array elements to keep in the output.
 * - If `false`, truthy entries of `subset` are assumed to indicate the array elements to retain the output.
 * - If `true`, truthy entries of `subset` are assumed to indicate the array elements to filter out in the output.
 *
 * @return {object} An object with the same keys as `x`, where each value is the desired subset of the corresponding array of `x`.
 */
export function subsetArrayCollection(x, subset, { filter = null } = {}) {
    let sub = {};
    let temporaries = [];
    let remaining;

    try {
        for (const [k, v] of Object.entries(x)) {
            let copy;

            if (filter === null) {
                copy = new v.constructor(subset.length);
                subset.forEach((x, i) => { copy[i] = v[x]; });
            } else {
                if (subset.length !== v.length) {
                    throw new Error("'subset' and each value of 'x' should have the same length");
                }
                let subcopy = subset;
                if (subset instanceof wa.WasmArray) {
                    subcopy = subset.array();
                }
                if (filter) {
                    copy = v.filter((x, i) => !subcopy[i]);
                } else {
                    copy = v.filter((x, i) => !!subcopy[i]); 
                }
            } 

            sub[k] = copy;
        }
    } catch (e) {
        for (const t of temporaries) {
            t.free();
        }
        throw e;
    }

    return sub;
}

/**
 * Split an array collection based on a factor of interest.
 * This is typically used to split the per-gene annotations to match any splitting of the data matrix in {@linkcode splitRows}.
 *
 * @param {object} x - Object containing arrays or TypedArrays, see {@linkcode validateArrayCollection}.
 * @param {object} split - Object describing how the arrays should be split, usually generated by {@linkcode splitByFactor}.
 *
 * @return {object} Object where each key is a factor level (i.e., a key of `split`).
 * Each value is an array collection that is sliced to the entries corresponding to that factor level.
 */
export function splitArrayCollection(x, split) {
    let splits = {};
    for (const [k, v] of Object.entries(split)) {
        splits[k] = subsetArrayCollection(x, v);
    }
    return splits;
}

/**
 * Combine multiple array collections by concatenating corresponding arrays with the same key across collections.
 * This is typically used to combine the per-cell annotations to match combined matrices in {@linkcode cbind}.
 *
 * @param {Array} inputs - Array of objects where each object is itself an array collection, see {@linkcode validateArrayCollection}.
 * @param {object} [options] - Optional parameters.
 * @param {?Array} [options.lengths=null] - Array of integers of length equal to `inputs`.
 * Each entry specifies the lengths of the arrays in the corresponding entry of `inputs`.
 * This needs to be supplied if any `inputs` are empty (i.e., no arrays) - otherwise, if `null`, this is inferred from `inputs`.
 *
 * @return {object} Object representing an array collection.
 * Each key corresponds to any key across `inputs` while each value is an array containing the concatenation of that key's arrays across all `inputs`.
 * If no corresponding array is present in a collection, its entries in the concatenated array is filled with `null`s.
 * The type of TypedArrays will only be preserved if it is the same across all of the key's arrays in `inputs`, otherwise it is converted into a regular array.
 */
export function combineArrayCollections(inputs, { lengths = null } = {}) {
    // Inferring lengths.
    if (lengths === null) {
        lengths = [];
        for (const current of inputs) {
            let curkeys = Object.keys(current);
            if (curkeys.length == 0) {
                throw new Error("all 'inputs' must be non-empty if 'lengths = null'");
            }
            lengths.push(current[curkeys[0]].length);
        }
    } else if (lengths.length != inputs.length) {
        throw new Error("'lengths' and 'inputs' should have the same length");
    }

    let total = 0;
    lengths.forEach(x => { total += x; });

    // Get all annotations keys across datasets; we then concatenate
    // columns with the same name, or we just fill them with missings.
    let ckeys = new Set();
    for (const current of inputs) {
        for (const a of Object.keys(current)) {
            ckeys.add(a);
        }
    }
    let anno_keys = Array.from(ckeys);

    let combined = {};
    for (const col of anno_keys) {
        // Preflight; falling back to an Array if there's any hint 
        // of inconsistency between the different objects.
        let constructor;
        for (var i = 0; i < lengths.length; i++) {
            let current = inputs[i];
            if (!(col in current)) {
                constructor = Array;
                break;
            }

            if (typeof constructor == "undefined") {
                constructor = current[col].constructor;
            } else if (constructor !== current[col].constructor) {
                constructor = Array;
                break;
            }
        }

        let current_combined = new constructor(total);
        let offset = 0;

        for (var i = 0; i < lengths.length; i++) {
            let current = inputs[i];
            let len = lengths[i];

            if (col in current) {
                if (current[col].length != len) {
                    throw new Error("mismatch in lengths for '" + col + "' in input object " + String(i + 1));
                }
                current[col].forEach((x, i) => { current_combined[i + offset] = x; });
            } else {
                current_combined.fill(null, offset, offset + len);
            }

            offset += len;
        }

        combined[col] = current_combined;
    }

    return combined;
}
