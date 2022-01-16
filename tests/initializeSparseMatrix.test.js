import * as scran from "../js/index.js";
import * as compare from "./compare.js";

test("initialization from compressed values works correctly", () => {
    var vals = new scran.Int32WasmArray(15);
    vals.set([1, 5, 2, 3, 7, 8, 9, 10, 4, 2, 1, 1, 3, 5, 8]);
    var indices = new scran.Int32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = new scran.Int32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var thing = scran.initializeSparseMatrixFromCompressed(11, 10, vals, indices, indptrs);
    expect(thing.nrow()).toBe(11);
    expect(thing.ncol()).toBe(10);

    // Extracting the row permutations.
    var perm = thing.permutation();
    expect(compare.equalArrays(perm, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(true);

    // Extracting the first and last columns to check for correctness.
    var col0 = thing.column(0);
    expect(compare.equalArrays(col0, [0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 0])).toBe(true);

    var col9 = thing.column(9);
    expect(compare.equalArrays(col9, [0, 0, 0, 0, 0, 0, 5, 0, 0, 8, 0])).toBe(true);

    // Doing the same for the rows.
    var row0 = thing.row(0);
    expect(compare.equalArrays(row0, [0, 0, 3, 0, 0, 0, 0, 0, 0, 0])).toBe(true);

    var row9 = thing.row(9);
    expect(compare.equalArrays(row9, [0, 0, 8, 0, 0, 0, 0, 0, 0, 8])).toBe(true);

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    thing.free();
})

test("initialization from compressed values works with permutations", () => {
    var vals = new scran.Int32WasmArray(15);
    vals.set([1, 5, 2, 1000000, 10, 8, 1000, 10, 4, 2, 1, 1, 3, 5, 8]); // first two rows contain elements beyond the range.
    var indices = new scran.Int32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = new scran.Int32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var thing = scran.initializeSparseMatrixFromCompressed(11, 10, vals, indices, indptrs);
    expect(thing.nrow()).toBe(11);
    expect(thing.ncol()).toBe(10);

    // Extracting the row permutations.
    var permutation = thing.permutation();
    expect(compare.equalArrays(permutation, [10, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);

    var row0 = thing.row(0); // basically gets row 2, which has been promoted to the first row.
    expect(compare.equalArrays(row0, [0, 0, 10, 10, 0, 0, 0, 0, 0, 0])).toBe(true);

    var row9 = thing.row(9); // gets row 1, which has been demoted to the second-last row.
    expect(compare.equalArrays(row9, [0, 0, 0, 1000, 0, 0, 0, 0, 0, 0])).toBe(true);

    var row10 = thing.row(10); // gets row 0, which has been demoted to the last row.
    expect(compare.equalArrays(row10, [0, 0, 1000000, 0, 0, 0, 0, 0, 0, 0])).toBe(true);

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    thing.free();
})
