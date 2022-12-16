import * as gc from "./gc.js";
import * as utils from "./utils.js";
import { PerCellQCFiltersResults } from "./computePerCellQCFilters.js";
import { PerCellAdtQcFiltersResults } from "./computePerCellAdtQcFilters.js";

/**
 * Filter out low-quality cells.
 *
 * @param {ScranMatrix} x The count matrix.
 * @param {(PerCellQCFiltersResults|PerCellAdtQcFiltersResults|Uint8WasmArray|Array|TypedArray)} filters 
 * If a {@linkplain PerCellQCFiltersResults} object is supplied, the overall filter (in `filters.discard_overall()`) is used.
 *
 * Otherwise, an array of length equal to the number of columns in `x` should be supplied,
 * where truthy elements specify the cells to be discarded.
 *
 * @return {ScranMatrix} A matrix of the same type as `x`, filtered by column to remove all cells specified in `filters`. 
 */
export function filterCells(x, filters) {
    var filter_data;
    var output;

    try {
        var ptr;
        if (filters instanceof PerCellQCFiltersResults || filters instanceof PerCellAdtQcFiltersResults) {
            var tmp = filters.discardOverall({ copy: false });
            ptr = tmp.byteOffset;
        } else {
            filter_data = utils.wasmifyArray(filters, "Uint8WasmArray");
            if (filter_data.length != x.numberOfColumns()) {
                throw new Error("length of 'filters' must be equal to number of columns in 'x'");
            }
            ptr = filter_data.offset;
        }

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
