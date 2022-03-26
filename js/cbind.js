import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import { ScranMatrix } from "./ScranMatrix.js";

function harvest_matrices(x) {
    let output = utils.createBigUint64WasmArray(x.length);
    let arr = output.array();
    for (var i = 0; i < x.length; i++) {
        arr[i] = BigInt(x[i].matrix.$$.ptr);
    }
    return output;
}

/**
 * Combine matrices by column.
 * If necessary, all matrices are permuted to match the row order in the first matrix.
 *
 * @param {Array} inputs - Array of one or more {@linkplain ScranMatrix} objects.
 * Any number of these may have a permuted row order.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.assumeSame] - Whether to assume all matrices in `inputs` have the same row order.
 * If `true`, no attempt is made to match the row order across matrices.
 *
 * @return A {@linkplain ScranMatrix} containing the matrices after combining them by column.
 */
export function cbind(inputs, { assumeSame = false } = {}) {
    let mat_ptrs;
    let raw;
    let output;

    try {
        mat_ptrs = harvest_matrices(inputs);
        raw = wasm.call(module => module.cbind(mat_ptrs.length, mat_ptrs.offset, assumeSame));
        output = new ScranMatrix(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    } finally {
        utils.free(mat_ptrs);
    }

    return output;
}

/**
 * Combine matrices by column, after subsetting each matrix to the intersection of common features.
 *
 * @param {Array} inputs - Array of one or more {@linkplain ScranMatrix} objects.
 * @param {Array} names - Array of length equal to `inputs`.
 * Each entry should be an Array containing the row names of the corresponding entry of `inputs`.
 * Names should correspond to the rows, so if an element of `inputs` has a permuted row order, the array of names should be similarly permuted to match.
 *
 * @return An object containing:
 * - `matrix`, a {@linkplain ScranMatrix} containing the combined matrices.
 * - `indices`, an `Int32Array` of length equal to the number of rows in `matrix`.
 *    This contains the index of the row in the first entry of `inputs` corresponding to each row of `matrix`,
 *    i.e., the gene at the `i`-th row of `matrix` is equivalent to the gene at the `indices[i]`-th row of `inputs[0]`.
 * - `names`, an array of names identifying the rows of `matrix`.
 *    This is constructed by indexing the first entry of `names` with `indices`.
 */
export function cbindWithNames(x, names) {
    let mat_ptrs;
    let renamed = [];
    let name_ptrs;
    let raw;
    let output = {};

    try {
        // Building a common set of rownames.
        if (names.length !== x.length) {
            throw new Error("length of 'names' should be equal to length of 'x'");
        }

        let common = {};
        let universe = [];
        for (var i = 0; i < names.length; i++) {
            if (x[i].numberOfRows() !== names[i].length) {
                throw new Error("length of each 'names' must equal number of rows of its corresponding 'x'");
            }
            names[i].forEach(x => {
                if (!(x in common)) {
                    common[x] = universe.length;
                    universe.push(x);
                }
            });
        }

        name_ptrs = utils.createBigUint64WasmArray(x.length);
        {
            let names_arr = name_ptrs.array();
            for (var i = 0; i < names.length; i++) {
                let current = names[i];
                let replacement = utils.createInt32WasmArray(current.length);
                let replacement_arr = replacement.array();
                current.forEach((x, i) => {
                    replacement_arr[i] = common[x];
                });
                renamed.push(replacement);
                names_arr[i] = BigInt(replacement.offset);
            }
        }

        mat_ptrs = harvest_matrices(x);
        raw = wasm.call(module => module.cbind_with_rownames(x.length, mat_ptrs.offset, name_ptrs.offset));
        output.matrix = new ScranMatrix(raw);

        // Even though isPermuted() is false, we can still get the gene indices via permutations().
        // This isn't entirely legit but whatever.
        output.indices = output.matrix.permutation();
        let internames = [];
        for (const i of output.indices) {
            internames.push(universe[i]);
        }
        output.names = internames;

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(mat_ptrs);
        utils.free(name_ptrs);
        for (const x of renamed) {
            utils.free(x);
        }
    }

    return output;
}
