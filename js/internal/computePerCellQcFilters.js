import * as utils from "./../utils.js";
import * as wasm from "../wasm.js";

export function computePerCellQcFilters(metrics, block, run) {
    var block_data;
    var output;

    try {
        var bptr = 0;
        var use_blocks = false;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != metrics.numberOfCells()) {
                throw new Error("'block' must be of length equal to the number of cells in 'metrics'");
            }
            use_blocks = true;
            bptr = block_data.offset;
        }

        output = run(metrics, use_blocks, bptr);

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(block_data);
    }

    return output;
}

export function applyFilter(thresholds, metrics, block, buffer) {
    var block_data;
    var rebuffer;
    var output;

    try {
        var bptr = 0;
        var use_blocks = false;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != metrics.numberOfCells()) {
                throw new Error("'block' must be of length equal to the number of cells in 'metrics'");
            }
            use_blocks = true;
            bptr = block_data.offset;
        }

        let optr;
        if (buffer == null) {
            rebuffer = utils.createUint8WasmArray(metrics.numberOfCells());
            optr = rebuffer.offset;
        } else {
            if (buffer.length != metrics.numberOfCells()) {
                throw new Error("'buffer' must be of length equal to the number of cells in 'metrics'");
            }
            optr = buffer.offset;
        }

        wasm.call(module => thresholds.filter(metrics.results.$$.ptr, use_blocks, bptr, optr));
        if (buffer == null) {
            output = rebuffer.slice();
        } else {
            output = buffer.array();
        }

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(block_data);
        utils.free(rebuffer);
    }

    return output;
}

