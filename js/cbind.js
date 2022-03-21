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
 * @param inputs - Array of one or more `ScranMatrix` objects.
 * Any number of these may have a permuted row order.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.assumeSame] - Whether to assume all matrices in `inputs` have the same row order.
 * If `true`, no attempt is made to match the row order across matrices.
 * 
 * @return A `ScranMatrix` containing the matrices after combining them by column.
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

export function cbindWithNames(x, names) {
    let mat_ptrs;
    let renamed = [];
    let name_ptrs;
    let raw;
    let output;

    try {
        // Building a common set of rownames.
        if (names.length !== x.length) {
            throw "length of 'names' should be equal to length of 'x'";
        }

        let common = {};
        let counter = 0;
        for (var i = 0; i < names.length; i++) {
            if (x[i].numberOfRows() !== names[i].length) {
                throw "length of each 'names' must equal number of rows of its corresponding 'x'";
            }
            names[i].forEach(x => {
                if (!(x in common)) {
                    common[x] = counter;
                    counter++;
                }
            });
        }

        name_ptrs = utils.createBigUint64WasmArray(x.length);
        for (var i = 0; i < names.length; i++) {
            let replacement = utils.createInt32WasmArray(names[i].length);
            names[i].forEach((x, i) => {
                replacement[i] = common[x];                
            });
            renamed.push(replacement);
            name_ptrs[i] = BigInt(replacement.offset);
        }

        mat_ptrs = harvest_matrices(x);
        raw = wasm.call(module => module.cbind_with_rownames(x.length, mat_ptrs.offset, name_ptrs_offset));
        output = ScranMatrix(raw);

    } catch (e) {
        utils.free(raw);

    } finally {
        utils.free(mat_ptrs);
        utils.free(name_ptrs);
        for (const x of renamed) {
            utils.free(x);
        }
    }

    return output;
}
