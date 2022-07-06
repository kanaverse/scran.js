import * as utils from "./../utils.js";

export function computePerCellQcFilters(metrics, block, length, run) {
    var block_data;
    var output;

    try {
        var bptr = 0;
        var use_blocks = false;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != length(metrics)) {
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
