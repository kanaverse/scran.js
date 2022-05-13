import * as utils from "./../utils.js";

export function computePerCellQcFilters(metrics, block, length, run, create) {
    var block_data;
    var raw;
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

        raw = run(metrics, use_blocks, bptr);
        output = create(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(block_data);
    }

    return output;
}
