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

export function applyFilter(thresholds, metrics, block, asTypedArray, buffer) {
    var block_data;
    var tmp;

    try {
        var bptr = 0;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != metrics.numberOfCells()) {
                throw new Error("'block' must be of length equal to the number of cells in 'metrics'");
            }
            bptr = block_data.offset;
        } else if (thresholds.is_blocked()) {
            throw new Error("'block' must be supplied if blocking was used to compute the thresholds")
        }

        if (buffer == null) {
            tmp = utils.createUint8WasmArray(metrics.numberOfCells());
            buffer = tmp;
        } else if (buffer.length != metrics.numberOfCells()) {
            throw new Error("'buffer' must be of length equal to the number of cells in 'metrics'");
        }

        wasm.call(module => thresholds.filter(metrics.results, bptr, buffer.offset));

    } catch (e) {
        utils.free(tmp);
        throw e;
    } finally {
        utils.free(block_data);
    }

    return utils.toTypedArray(buffer, tmp == null, asTypedArray);
}
