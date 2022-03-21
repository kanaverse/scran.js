import * as spmat from "./SparseMatrix.js";
import * as utils from "./utils.js";

function cbind(x, { rowNames = null } = {}) {
    let mat_ptrs;

    let use_rownames = (rowNames !== null);
    let renamed = [];
    let name_ptrs;

    let raw;
    let output;

    try {
        // Building a common set of rownames.
        if (use_rownames) {
            if (rowNames.length !== x.length) {
                throw "length of 'rowNames' should be equal to length of 'x'";
            }

            let common = {};
            let counter = 0;
            for (var i = 0; i < rowNames.length; i++) {
                if (x[i].numberOfRows() !== rowNames[i].length) {
                    throw "length of each 'rowNames' must equal number of rows of its corresponding 'x'";
                }
                rowNames[i].forEach(x => {
                    if (!(x in common)) {
                        common[x] = counter;
                        counter++;
                    }
                });
            }

            name_ptrs = utils.createBigUint64WasmArray(x.length);
            for (var i = 0; i < rowNames.length; i++) {
                let replacement = utils.createInt32WasmArray(rowNames[i].length);
                rowNames[i].forEach((x, i) => {
                    replacement[i] = common[x];                
                });
                renamed.push(replacement);
                name_ptrs[i] = BigInt(replacement.offset);
            }
        }

        mat_ptrs = utils.createBigUint64WasmArray(x.length);
        for (var i = 0; i < x.length; i++) {
            mat_ptrs[i] = BigInt(x[i].matrix.$$.ptr);
        }

        raw = wasm.call(module => module.cbind_with_rownames(x.length, mat_ptrs.offset, use_rownames, name_ptrs_offset));
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



