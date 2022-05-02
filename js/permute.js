import {ScranMatrix} from "./ScranMatrix.js";

/**
 * Permute (or subset) a vector so that its values correspond the row identities of a {@linkplain ScranMatrix}.
 * This is usually applied to feature annotations that correspond to the row identities in the original dataset,
 * but need to be permuted to be used in conjunction with a {@linkplain ScranMatrix} that has a non-trivial permutation.
 *
 * @param {(ScranMatrix|Int32Array)} x - A {@linkplain ScranMatrix} where the rows are permuted for a more memory-efficient storage order.
 * Alternatively a row identity vector, generated by calling {@linkcode ScranMatrix#identities identities}.
 * @param {(Array|TypedArray)} values - An array of values where each entry corresponds to a row in the original row order.
 *
 * @return A copy of `values` is returned, permuted or subsetted so that each entry corresponds to a row of `x`.
 */
export function permuteVector(x, values) {
    let perm = null;
    if (x instanceof ScranMatrix) {
        if (x.isPermuted()) {
            perm = x.identities();
        }
    } else {
        perm = x;
    }

    if (perm !== null) {
        let copy = new values.constuctor(perm.length);
        perm.forEach((x, i) => {
            copy[i] = values[x];
        });
    }

    return copy;
}

/**
 * Create a permutation vector to update old results to match the row identities of a {@linkplain ScranMatrix}.
 * This is provided as a safety measure to handle changes in the order of rows across different versions of the {@linkplain ScranMatrix} initialization.
 * The premise is that there are some old results that are ordered to match the row identities of an old version of a {@linkplain ScranMatrix}.
 * Given the old row identity vector, this function will enable applications to update their result vectors to match the row identities of the new object.
 *
 * @param {(ScranMatrix|Int32Array)} x - A {@linkplain ScranMatrix} where the rows are permuted for a more memory-efficient storage order.
 * Alternatively a row identity vector, generated by calling {@linkcode ScranMatrix#identities identities}.
 * @param {TypedArray} old - A row identity vector for an older sparse matrix generated from the same dataset as `x`. 
 * This vector should have been created by calling {@linkcode ScranMatrix#identities identities}.
 *
 * @return `null` if the permutations are the same, in which case no further action is required.
 * Otherwise an Int32Array is returned containing a permutation to match the row order of `x`.
 * (For example, applying the permutation to `old` will yield the same row identities as `x`.)
 */
export function updatePermutation(x, old) {
    let perm = null;
    let NR;
    if (x instanceof ScranMatrix) {
        NR = x.numberOfRows();
        if (x.isPermuted()) {
            if (old.length != NR) {
                throw new Error("number of rows in 'x' should be the same as length of 'old'");
            }
            perm = x.identities();
        }
    } else {
        NR = x.length;
        if (old.length != NR) {
            throw new Error("length of 'x' should be the same as length of 'old'");
        }
        perm = x;
    }

    if (perm !== null) {
        let same = true;
        for (const [index, val] of perm.entries()) {
            if (old[index] != val) {
                same = false;
                break;
            }
        }
        if (same) {
            return null;
        }
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
