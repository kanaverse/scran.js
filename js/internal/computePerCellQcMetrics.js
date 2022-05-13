import * as wasm from "../wasm.js";
import * as utils from "../utils.js"; 
import * as wa from "wasmarrays.js";

export function computePerCellQcMetrics(x, subsets, run, create) {
    var output;
    var raw;

    try {
        if (subsets instanceof wa.Uint8WasmArray) {
            let nsubsets = Math.round(subsets.length / x.numberOfRows());
            if (nsubsets * x.numberOfRows() != subsets.length) {
                throw new Error("length of 'subsets' should be a multiple of the matrix rows");
            }

            // This will either create a cheap view, or it'll clone
            // 'subsets' into the appropriate memory space.
            let converted = utils.wasmifyArray(subsets, "Uint8WasmArray");
            try {
                let ptr = subsets.offset;
                raw = run(x.matrix, nsubsets, ptr);
            } finally {
                converted.free();
            }

        } else if (subsets instanceof Array) {
            let tmp = utils.createUint8WasmArray(x.numberOfRows() * subsets.length);
            try {
                let offset = 0;
                for (var i = 0; i < subsets.length; i++) {
                    let current = subsets[i];
                    if (current.length != x.numberOfRows()) {
                        throw new Error("length of each array in 'subsets' should be equal to the matrix rows");
                    }
                    tmp.array().set(current, offset);
                    offset += current.length;
                }
                raw = run(x.matrix, subsets.length, tmp.offset);
            } finally {
                tmp.free();
            }

        } else if (subsets === null) {
            raw = run(x.matrix, 0, 0);

        } else {
            throw new Error("'subsets' should be an Array or Uint8WasmArray");
        }

        output = create(raw);
    } catch (e) {
        utils.free(raw);
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

