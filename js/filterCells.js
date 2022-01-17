import Module from "./Module.js";
import * as utils from "./utils.js";
import { PerCellQCFilters } from "./computePerCellQCFilters.js";

/**
 * Filter out low-quality cells.
 *
 * @param {SparseMatrix} x The count matrix.
 * @param {(PerCellQCFilters|Uint8WasmArray|Array|TypedArray)} filters 
 * If a `PerCellQCFilters` object is supplied, the overall filter (in `filters.discard_overall()`) is used.
 * Otherwise, an array should be supplied where `true` elements specify the cells to be discarded.
 *
 * @param A matrix of the same type as `x` containing the filtered count matrix.
 */
export function filterCells(x, filters) {
    var filter_data;
    var raw;
    var output;

    try {
        var ptr;
        if (filters instanceof PerCellQCFilters) {
            var tmp = filters.discardOverall(false);
            ptr = tmp.byteOffset;
        } else {
            filter_data = utils.wasmifyArray(filters, "Uint8WasmArray");
            ptr = filter_data.offset;
        }

        raw = utils.wrapModuleCall(() => Module.filter_cells(x.matrix, ptr, false));
        output = new x.constructor(raw);

    } catch(e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(filter_data);
    }

    return output;
}
