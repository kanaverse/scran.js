import * as gc from "./gc.js";
import * as utils from "./utils.js";

/**
 * Filter out low-quality cells.
 *
 * @param {ScranMatrix} x The count matrix.
 * @param {(Uint8WasmArray|Array|TypedArray)} filters 
 * An array of length equal to the number of columns in `x`, where truthy elements specify the cells to be discarded.
 *
 * @return {ScranMatrix} A matrix of the same type as `x`, filtered by column to remove all cells specified in `filters`. 
 */
export function filterCells(x, filters) {
    var filter_data;
    var output;

    try {
        filter_data = utils.wasmifyArray(filters, "Uint8WasmArray");
        if (filter_data.length != x.numberOfColumns()) {
            throw new Error("length of 'filters' must be equal to number of columns in 'x'");
        }
        var ptr = filter_data.offset;

        output = gc.call(
            module => module.filter_cells(x.matrix, ptr, false),
            x.constructor
        );

    } catch(e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(filter_data);
    }

    return output;
}
