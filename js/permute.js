import {ScranMatrix} from "./ScranMatrix.js";

/**
 * Create a permutation vector to update old results to match the row identities of a {@linkplain ScranMatrix}.
 * This is provided as a safety measure to handle changes in the order of rows across different versions of the {@linkplain ScranMatrix} initialization.
 * The premise is that there are some old results that are ordered to match the row identities of an old version of a {@linkplain ScranMatrix}.
 * Given the old row identity vector, this function will enable applications to update their result vectors to match the row identities of the new object.
 *
 * @param {?Int32Array} x - A row identity vector, of length equal to the number of features in a ScranMatrix.
 * If `null`, it is assumed to contain consecutive integers from `[0, values.length)`.
 * @param {TypedArray} old - A row identity vector for an older sparse matrix generated from the same dataset as `x`. 
 *
 * @return {?Int32Array}
 * `null` is returned if the new and old row identities are the same, in which case no further action is required.
 *
 * Otherwise, an Int32Array is returned containing a permutation to be applied to vectors to match the row identities of `x`.
 * (For example, applying the permutation to `old` will yield the same row identities as `x`.)
 */
export function updateRowIdentities(x, old) {
    if (x instanceof ScranMatrix) {
        throw new Error("supplying a ScranMatrix is deprecated");
    }

    let perm = x;
    let NR;
    if (perm === null) {
        NR = old.length;
    } else {
        NR = x.length;
        if (old.length != NR) {
            throw new Error("length of 'x' should be the same as length of 'old'");
        }
    }

    let same = true;
    if (perm !== null) {
        for (const [index, val] of perm.entries()) {
            if (old[index] != val) {
                same = false;
                break;
            }
        }
    } else {
        for (const [index, val] of old.entries()) {
            if (val != index) {
                same = false;
                break;
            }
        }
    }
    if (same) {
        return null;
    }

    let mapping = {};
    old.forEach((x, i) => { mapping[x] = i; });
    let output = new Int32Array(NR);

    if (perm !== null) {
        for (var i = 0; i < perm.length; i++) {
            let p = perm[i];
            if (!(p in mapping)) {
                throw new Error("mismatch in row identities between 'x' and 'old'");
            }
            output[i] = mapping[p];
        }
    } else {
        for (var p = 0; p < NR; p++) {
            if (!(p in mapping)) {
                throw new Error("mismatch in row identities between 'x' and 'old'");
            }
            output[p] = mapping[p];
        }
    }

    return output;
}
