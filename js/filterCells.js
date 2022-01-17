import Module from "./Module.js";
import * as utils from "./utils.js";
import { PerCellQCFilters } from "./computePerCellQCFilters.js";

/**
 * Filter out low-quality cells.
 *
 * @param {SparseMatrix} x The count matrix.
 * @param {(PerCellQCFilters|Uint8WasmArray)} filters 
 * If a `PerCellQCFilters` object is supplied, the overall filter (in `filters.discard_overall()`) is used.
 * Otherwise, an array should be supplied where `true` elements specify the cells to be discarded.
 *
 * @param A matrix of the same type as `x` containing the filtered count matrix.
 */
export function filterCells(x, filters) {
    var ptr;
    var output;

    if (filters instanceof PerCellQCFilters) {
        var tmp = filters.discard_overall(false);
        ptr = tmp.byteOffset;
    } else {
        ptr = filters.ptr;
    }

    try {
        output = Module.filter_cells(x.matrix, ptr, false);
    } catch (e) {
        throw utils.processErrorMessage(e);
    }

    return new x.constructor(output);
}
