import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as pako from "pako";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("initialization from dense array works correctly", () => {
    var vals = scran.createInt32WasmArray(15);
    vals.set([1, 5, 0, 0, 7, 0, 0, 10, 4, 2, 0, 0, 0, 5, 8]);

    var mat = scran.initializeSparseMatrixFromDenseArray(3, 5, vals);
    expect(mat.numberOfRows()).toBe(3);
    expect(mat.numberOfColumns()).toBe(5);
    expect(mat.isReorganized()).toBe(true);
    expect(mat.isSparse()).toBe(true);

    // Properly column-major.
    expect(compare.equalArrays(mat.column(0), [1, 5, 0])).toBe(true);
    expect(compare.equalArrays(mat.column(4), [0, 5, 8])).toBe(true);
    expect(compare.equalArrays(mat.row(0), [1, 0, 0, 2, 0])).toBe(true);
    expect(compare.equalArrays(mat.row(2), [0, 0, 4, 0, 8])).toBe(true);

    // Works with pre-supplied buffers.
    let row_buf = scran.createFloat64WasmArray(5);
    expect(compare.equalArrays(mat.row(1, { buffer: row_buf }), [5, 7, 10, 0, 5])).toBe(true);
    let col_buf = scran.createFloat64WasmArray(3);
    expect(compare.equalArrays(mat.column(2, { buffer: col_buf }), [0, 10, 4])).toBe(true);

    // Compare to a simple initialization.
    var dense = scran.initializeDenseMatrixFromDenseArray(3, 5, vals);
    expect(dense.numberOfRows()).toBe(3);
    expect(dense.numberOfRows()).toBe(3);
    expect(dense.isReorganized()).toBe(false);
    expect(dense.isSparse()).toBe(false);

    // freeing everything.
    vals.free();
    mat.free();
    col_buf.free();
    row_buf.free();
})

test("initialization from compressed values works correctly", () => {
    var vals = scran.createInt32WasmArray(15);
    vals.set([1, 5, 2, 3, 7, 8, 9, 10, 4, 2, 1, 1, 3, 5, 8]);
    var indices = scran.createInt32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = scran.createInt32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var mat = scran.initializeSparseMatrixFromCompressedVectors(11, 10, vals, indices, indptrs);
    expect(mat.numberOfRows()).toBe(11);
    expect(mat.numberOfColumns()).toBe(10);
    expect(mat.isReorganized()).toBe(true);

    // Extracting the row identities.
    var id = mat.identities();
    expect(compare.equalArrays(id, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(true);

    let id_buffer = scran.createInt32WasmArray(11);
    expect(compare.equalArrays(id, mat.identities({ buffer: id_buffer }))).toBe(true);

    // Extracting the first and last columns to check for correctness.
    expect(compare.equalArrays(mat.column(0), [0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 0])).toBe(true);
    expect(compare.equalArrays(mat.column(9), [0, 0, 0, 0, 0, 0, 5, 0, 0, 8, 0])).toBe(true);

    // Doing the same for the rows.
    expect(compare.equalArrays(mat.row(0), [0, 0, 3, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(compare.equalArrays(mat.row(9), [0, 0, 8, 0, 0, 0, 0, 0, 0, 8])).toBe(true);

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    mat.free();
    id_buffer.free();
})

test("initialization from compressed values works with reorganization", () => {
    var vals = scran.createInt32WasmArray(15);
    vals.set([1, 5, 2, 1000000, 10, 8, 1000, 10, 4, 2, 1, 1, 3, 5, 8]); // first two rows contain elements beyond the range.
    var indices = scran.createInt32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = scran.createInt32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var mat = scran.initializeSparseMatrixFromCompressedVectors(11, 10, vals, indices, indptrs);
    expect(mat.numberOfRows()).toBe(11);
    expect(mat.numberOfColumns()).toBe(10);
    expect(mat.isReorganized()).toBe(true);

    // Extracting the row identities.
    var ids = mat.identities();
    expect(compare.equalArrays(ids, [2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 0])).toBe(true);

    expect(compare.equalArrays(mat.row(0), [0, 0, 10, 10, 0, 0, 0, 0, 0, 0])).toBe(true); // basically gets row 2, which has been promoted to the first row.
    expect(compare.equalArrays(mat.row(9), [0, 0, 0, 1000, 0, 0, 0, 0, 0, 0])).toBe(true); // gets row 1, which has been demoted to the second-last row.
    expect(compare.equalArrays(mat.row(10), [0, 0, 1000000, 0, 0, 0, 0, 0, 0, 0])).toBe(true); // gets row 0, which has been demoted to the last row.

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    mat.free();
})

test("initialization from MatrixMarket works correctly", () => {
    var content = "%%\n11 5 6\n1 2 5\n10 3 2\n7 4 22\n5 1 12\n6 3 2\n1 5 8\n";
    const converter = new TextEncoder();
    var raw_buffer = converter.encode(content);

    var buffer = scran.createUint8WasmArray(raw_buffer.length);
    buffer.set(raw_buffer);

    var mat = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);
    expect(mat.numberOfRows()).toBe(11);
    expect(mat.numberOfColumns()).toBe(5);
    expect(mat.isReorganized()).toBe(true);

    expect(compare.equalArrays(mat.row(0), [0, 5, 0, 0, 8]));
    expect(compare.equalArrays(mat.column(4), [0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0]));

    // Cleaning up.
    mat.free();
    buffer.free();
})

test("initialization from Gzipped MatrixMarket works correctly with Gzip", () => {
    var content = "%%\n11 5 6\n1 2 5\n10 3 2\n7 4 22\n5 1 12\n6 3 2\n1 5 8\n";
    const raw_buffer = pako.gzip(content);

    var buffer = scran.createUint8WasmArray(raw_buffer.length);
    buffer.set(raw_buffer);

    var mat = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);
    expect(mat.numberOfRows()).toBe(11);
    expect(mat.numberOfColumns()).toBe(5);
    expect(mat.isReorganized()).toBe(true);

    expect(compare.equalArrays(mat.row(0), [0, 5, 0, 0, 8]));
    expect(compare.equalArrays(mat.column(4), [0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0]));
    
    // Just checking that the it's actually compressed.
    var mat2 = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer, { compressed: true });
    expect(mat2.numberOfRows()).toBe(11);
    expect(mat2.numberOfColumns()).toBe(5);

    // Cleaning up.
    mat.free();
    mat2.free();
    buffer.free();
})
