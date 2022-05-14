import * as wasm from "../wasm.js";
import * as utils from "../utils.js"; 
import * as wa from "wasmarrays.js";

export function computePerCellQcMetrics(x, subsets, run, create) {
    var output;
    var raw;
    var tmp_subsets = [];
    var subset_offsets;

    try {
        let nsubsets = 0;
        let offset_offset = 0;

        if (subsets != null) {
            nsubsets = subsets.length;
            subset_offsets = utils.createBigUint64WasmArray(nsubsets);
            offset_offset = subset_offsets.offset;
            let offset_arr = subset_offsets.array();

            for (var i = 0; i < nsubsets; i++) {
                // This will either create a cheap view, or it'll clone
                // 'subsets' into the appropriate memory space.
                let current = utils.wasmifyArray(subsets[i], "Uint8WasmArray");
                if (current.length != x.numberOfRows()) {
                    throw new Error("length of each array in 'subsets' should be equal to the matrix rows");
                }
                tmp_subsets.push(current);
                offset_arr[i] = BigInt(current.offset);
            }
        }

        raw = run(x.matrix, nsubsets, offset_offset);
        output = create(raw);
    } catch (e) {
        utils.free(raw);
        utils.free(subset_offsets);
        for (const y of tmp_subsets) {
            utils.free(y);
        }
        throw e;
    }

    return output;
}

export function emptyPerCellQcMetricsResults(create1, create2) {
    let raw;
    let output;

    try {
        raw = create1();
        output = create2(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    }

    return output;
}

