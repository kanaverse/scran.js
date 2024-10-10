import { subsetColumns } from "./subset.js";

/**
 * Filter out low-quality cells.
 *
 * @param {ScranMatrix} x The count matrix.
 * @param {(Uint8WasmArray|Array|TypedArray)} filters 
 * An array of length equal to the number of columns in `x`, where truthy elements specify the cells to keep.
 *
 * @return {ScranMatrix} A matrix of the same type as `x`, filtered by column to only retain cells in `filters`. 
 */
export function filterCells(x, filters) {
    var indices = [];
    filters.forEach((x, i) => {
        if (x != 0) {
            indices.push(i);
        }
    });
    return subsetColumns(x, indices);
}
