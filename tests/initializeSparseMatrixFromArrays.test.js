import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as pako from "pako";
import * as fs from "fs";
import * as simulate from "./simulate.js";

const dir = "MatrixMarket-test-files";
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("initialization from dense array works correctly", () => {
    let nr = 3;
    let nc = 5;
    var vals = scran.createInt32WasmArray(15);
    vals.set([1, 5, 0, 0, 7, 0, 0, 10, 4, 2, 0, 0, 0, 5, 8]);

    var mat = scran.initializeSparseMatrixFromDenseArray(nr, nc, vals);
    expect(mat.numberOfRows()).toBe(nr);
    expect(mat.numberOfColumns()).toBe(nc);
    expect(mat.isSparse()).toBe(true);

    // Compare to a non-layered initialization.
    var mat2 = scran.initializeSparseMatrixFromDenseArray(nr, nc, vals, { layered: false });
    expect(mat2.numberOfRows()).toBe(nr);
    expect(mat2.numberOfColumns()).toBe(nc);
    expect(mat2.isSparse()).toBe(true);

    // Compare to a dense initialization.
    var dense = scran.initializeDenseMatrixFromDenseArray(nr, nc, vals);
    expect(dense.numberOfRows()).toBe(nr);
    expect(dense.numberOfColumns()).toBe(nc);
    expect(dense.isSparse()).toBe(false);

    // Extracts values correctly.
    for (var i = 0; i < nc; i++) {
        let ref = vals.slice(i * nr, (i + 1) * nr);
        expect(compare.equalArrays(mat.column(i), ref)).toBe(true);
        expect(compare.equalArrays(mat2.column(i), ref)).toBe(true);
        expect(compare.equalArrays(dense.column(i), ref)).toBe(true);
    }

    // Extraction works with pre-supplied buffers.
    let row_buf = scran.createFloat64WasmArray(nc);
    expect(compare.equalArrays(mat.row(1, { buffer: row_buf }), [5, 7, 10, 0, 5])).toBe(true);
    let col_buf = scran.createFloat64WasmArray(nr);
    expect(compare.equalArrays(mat.column(2, { buffer: col_buf }), [0, 10, 4])).toBe(true);

    // freeing everything.
    vals.free();
    mat.free();
    mat2.free();
    dense.free();
    col_buf.free();
    row_buf.free();
})

test("forced integers from dense array works correctly", () => {
    let nr = 5;
    let nc = 3;
    var vals = scran.createFloat64WasmArray(15);
    vals.set([1.2, 2.5, 0, 0, 7.1, 0, 0, 10.1, 4.2, 2.3, 0, 0, 0, 5.3, 8.1]);

    var smat1 = scran.initializeSparseMatrixFromDenseArray(nr, nc, vals, { forceInteger: true, layered: false });
    var smat2 = scran.initializeSparseMatrixFromDenseArray(nr, nc, vals, { forceInteger: false });
    var dmat1 = scran.initializeDenseMatrixFromDenseArray(nr, nc, vals, { forceInteger: true });
    var dmat2 = scran.initializeDenseMatrixFromDenseArray(nr, nc, vals, { forceInteger: false });
    var default_dmat = scran.initializeDenseMatrixFromDenseArray(nr, nc, vals);
    expect(default_dmat.isSparse()).toBe(false);

    for (var i = 0; i < nc; i++) {
        let ref = vals.slice(i * nr, (i + 1) * nr);
        let trunc = ref.map(Math.trunc);

        expect(compare.equalArrays(smat1.column(i), trunc)).toBe(true);
        expect(compare.equalArrays(smat2.column(i), ref)).toBe(true);
        expect(compare.equalArrays(dmat1.column(i), trunc)).toBe(true);
        expect(compare.equalArrays(dmat2.column(i), ref)).toBe(true);
        expect(compare.equalArrays(default_dmat.column(i), ref)).toBe(true);
    }

    // Cleaning up.
    vals.free();
    smat1.free();
    smat2.free();
    dmat1.free();
    dmat2.free();
    default_dmat.free();
})

test("initialization from compressed values works correctly", () => {
    var vals = scran.createInt32WasmArray(15);
    vals.set([1, 5, 2, 3, 7, 8, 9, 10, 4, 2, 1, 1, 3, 5, 8]);
    var indices = scran.createInt32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = scran.createInt32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var mat = scran.initializeSparseMatrixFromSparseArrays(10, 11, vals, indices, indptrs, { layered: false });
    expect(mat.numberOfRows()).toBe(10);
    expect(mat.numberOfColumns()).toBe(11);
    expect(mat.isSparse()).toBe(true);

    // Extracting the first and last rows to check for correctness.
    expect(compare.equalArrays(mat.row(0), [0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 0])).toBe(true);
    expect(compare.equalArrays(mat.row(9), [0, 0, 0, 0, 0, 0, 5, 0, 0, 8, 0])).toBe(true);

    // Doing the same for the rows.
    expect(compare.equalArrays(mat.column(0), [0, 0, 3, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(compare.equalArrays(mat.column(9), [0, 0, 8, 0, 0, 0, 0, 0, 0, 8])).toBe(true);

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    mat.free();
})

test("initialization from compressed values works with forced integers", () => {
    var vals = scran.createFloat64WasmArray(15);
    vals.set([1.2, 5.3, 2.6, 3.9, 7.2, 8.1, 9.3, 10.9, 4.6, 2.4, 1.7, 1.1, 3.2, 5.7, 8.8]);
    var indices = scran.createInt32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 3, 1, 2, 5, 5, 6, 8, 8, 6, 7]);
    var indptrs = scran.createInt32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var mat1 = scran.initializeSparseMatrixFromSparseArrays(10, 9, vals, indices, indptrs, { forceInteger: false });
    expect(compare.equalArrays(mat1.row(0), [0, 0, 0, 1.2, 0, 5.3, 0, 0, 0])).toBe(true);
    expect(compare.equalArrays(mat1.row(9), [0, 0, 0, 0, 0, 0, 5.7, 8.8, 0])).toBe(true);

    var mat2 = scran.initializeSparseMatrixFromSparseArrays(10, 9, vals, indices, indptrs, { layered: false });
    for (var i = 0; i < 9; i++) {
        let col1 = mat1.column(i);
        let trunc = col1.map(Math.trunc);
        let col2 = mat2.column(i);
        expect(compare.equalArrays(col2, trunc)).toBe(true);
    }

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    mat1.free();
    mat2.free();
})

test("initialization from compressed values works with layering", () => {
    var vals = scran.createInt32WasmArray(15);
    vals.set([1, 5, 2, 1000000, 10, 8, 1000, 10, 4, 2, 1, 1, 3, 5, 8]); // first two rows contain elements beyond the range.
    var indices = scran.createInt32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = scran.createInt32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var mat = scran.initializeSparseMatrixFromSparseArrays(11, 10, vals, indices, indptrs, { byRow: false });
    expect(mat.numberOfRows()).toBe(11);
    expect(mat.numberOfColumns()).toBe(10);

    // Checking the contents. 
    expect(compare.equalArrays(mat.row(2), [0, 0, 10, 10, 0, 0, 0, 0, 0, 0])).toBe(true); 
    expect(compare.equalArrays(mat.row(1), [0, 0, 0, 1000, 0, 0, 0, 0, 0, 0])).toBe(true); 
    expect(compare.equalArrays(mat.row(0), [0, 0, 1000000, 0, 0, 0, 0, 0, 0, 0])).toBe(true); 

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    mat.free();
})
