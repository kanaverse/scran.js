import * as scran from "../js/index.js";
import * as compare from "./compare.js";

test("initialization from compressed values works correctly", () => {
    var vals = new scran.WasmArray(15, "Int32Array");
    vals.set([1, 5, 2, 3, 7, 8, 9, 10, 4, 2, 1, 1, 3, 5, 8]);
    var indices = new scran.WasmArray(15, "Int32Array");
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = new scran.WasmArray(11, "Int32Array");
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var thing = scran.initializeSparseMatrixFromCompressed(11, 10, vals, indices, indptrs);
    expect(thing.nrow()).toBe(11);
    expect(thing.ncol()).toBe(10);

    // Extracting the row permutations.
    var permbuf = new scran.WasmArray(11, "Int32Array");
    thing.permutation(permbuf.ptr);
    expect(compare.equalArrays(permbuf.array(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(true);

    // Extracting the first and last columns to check for correctness.
    var colbuf = new scran.WasmArray(11, "Float64Array");
    thing.column(0, colbuf.ptr);
    expect(compare.equalArrays(colbuf.array(), [0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 0])).toBe(true);

    thing.column(9, colbuf.ptr);
    expect(compare.equalArrays(colbuf.array(), [0, 0, 0, 0, 0, 0, 5, 0, 0, 8, 0])).toBe(true);

    // Doing the same for the rows.
    var rowbuf = new scran.WasmArray(10, "Float64Array");
    thing.row(0, rowbuf.ptr);
    expect(compare.equalArrays(rowbuf.array(), [0, 0, 3, 0, 0, 0, 0, 0, 0, 0])).toBe(true);

    thing.row(9, rowbuf.ptr);
    expect(compare.equalArrays(rowbuf.array(), [0, 0, 8, 0, 0, 0, 0, 0, 0, 8])).toBe(true);
})

test("initialization from compressed values works with permutations", () => {
    var vals = new scran.WasmArray(15, "Int32Array");
    vals.set([1, 5, 2, 1000000, 10, 8, 1000, 10, 4, 2, 1, 1, 3, 5, 8]); // first two rows contain elements beyond the range.
    var indices = new scran.WasmArray(15, "Int32Array");
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = new scran.WasmArray(11, "Int32Array");
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var thing = scran.initializeSparseMatrixFromCompressed(11, 10, vals, indices, indptrs);
    expect(thing.nrow()).toBe(11);
    expect(thing.ncol()).toBe(10);

    // Extracting the row permutations.
    var permbuf = new scran.WasmArray(11, "Int32Array");
    thing.permutation(permbuf.ptr);
    expect(compare.equalArrays(permbuf.array(), [10, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);

    var rowbuf = new scran.WasmArray(10, "Float64Array");
    thing.row(0, rowbuf.ptr); // basically gets row 2, which has been promoted to the first row.
    expect(compare.equalArrays(rowbuf.array(), [0, 0, 10, 10, 0, 0, 0, 0, 0, 0])).toBe(true);

    thing.row(9, rowbuf.ptr); // gets row 1, which has been demoted to the second-last row.
    expect(compare.equalArrays(rowbuf.array(), [0, 0, 0, 1000, 0, 0, 0, 0, 0, 0])).toBe(true);

    thing.row(10, rowbuf.ptr); // gets row 0, which has been demoted to the last row.
    expect(compare.equalArrays(rowbuf.array(), [0, 0, 1000000, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
})
