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
    expect(mat.matrix.numberOfRows()).toBe(nr);
    expect(mat.matrix.numberOfColumns()).toBe(nc);
    expect(mat.matrix.isSparse()).toBe(true);
    expect(mat.row_ids.length).toBe(nr);

    // Compare to a non-layered initialization.
    var mat2 = scran.initializeSparseMatrixFromDenseArray(nr, nc, vals, { layered: false });
    expect(mat2.matrix.numberOfRows()).toBe(nr);
    expect(mat2.matrix.numberOfColumns()).toBe(nc);
    expect(mat2.matrix.isSparse()).toBe(true);
    expect(mat2.row_ids).toBeNull();

    // Compare to a dense initialization.
    var dense = scran.initializeDenseMatrixFromDenseArray(nr, nc, vals);
    expect(dense.numberOfRows()).toBe(nr);
    expect(dense.numberOfColumns()).toBe(nc);
    expect(dense.isReorganized()).toBe(false);
    expect(dense.isSparse()).toBe(false);

    // Properly column-major.
    for (var i = 0; i < nc; i++) {
        let ref = vals.slice(i * nr, (i + 1) * nr);
        expect(compare.equalArrays(mat.matrix.column(i), ref)).toBe(true);
        expect(compare.equalArrays(mat2.matrix.column(i), ref)).toBe(true);
        expect(compare.equalArrays(dense.column(i), ref)).toBe(true);
    }

    // Extraction works with pre-supplied buffers.
    let row_buf = scran.createFloat64WasmArray(nc);
    expect(compare.equalArrays(mat.matrix.row(1, { buffer: row_buf }), [5, 7, 10, 0, 5])).toBe(true);
    let col_buf = scran.createFloat64WasmArray(nr);
    expect(compare.equalArrays(mat.matrix.column(2, { buffer: col_buf }), [0, 10, 4])).toBe(true);

    // freeing everything.
    vals.free();
    mat.matrix.free();
    mat2.matrix.free();
    dense.free();
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

    var mat = scran.initializeSparseMatrixFromCompressedVectors(11, 10, vals, indices, indptrs, { layered: false });
    expect(mat.matrix.numberOfRows()).toBe(11);
    expect(mat.matrix.numberOfColumns()).toBe(10);
    expect(mat.matrix.isSparse()).toBe(true);
    expect(mat.row_ids).toBeNull();

    // Extracting the first and last columns to check for correctness.
    expect(compare.equalArrays(mat.matrix.column(0), [0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 0])).toBe(true);
    expect(compare.equalArrays(mat.matrix.column(9), [0, 0, 0, 0, 0, 0, 5, 0, 0, 8, 0])).toBe(true);

    // Doing the same for the rows.
    expect(compare.equalArrays(mat.matrix.row(0), [0, 0, 3, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(compare.equalArrays(mat.matrix.row(9), [0, 0, 8, 0, 0, 0, 0, 0, 0, 8])).toBe(true);

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    mat.matrix.free();
})

test("initialization from compressed values works with reorganization", () => {
    var vals = scran.createInt32WasmArray(15);
    vals.set([1, 5, 2, 1000000, 10, 8, 1000, 10, 4, 2, 1, 1, 3, 5, 8]); // first two rows contain elements beyond the range.
    var indices = scran.createInt32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = scran.createInt32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

    var mat = scran.initializeSparseMatrixFromCompressedVectors(11, 10, vals, indices, indptrs);
    expect(mat.matrix.numberOfRows()).toBe(11);
    expect(mat.matrix.numberOfColumns()).toBe(10);
    expect(mat.row_ids.length).toBe(11);

    // Extracting the row identities.
    var ids = mat.row_ids;
    expect(compare.equalArrays(ids, [2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 0])).toBe(true);

    // Checking the contents. 
    expect(compare.equalArrays(mat.matrix.row(0), [0, 0, 10, 10, 0, 0, 0, 0, 0, 0])).toBe(true); // basically gets row 2, which has been promoted to the first row.
    expect(compare.equalArrays(mat.matrix.row(9), [0, 0, 0, 1000, 0, 0, 0, 0, 0, 0])).toBe(true); // gets row 1, which has been demoted to the second-last row.
    expect(compare.equalArrays(mat.matrix.row(10), [0, 0, 1000000, 0, 0, 0, 0, 0, 0, 0])).toBe(true); // gets row 0, which has been demoted to the last row.

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    mat.matrix.free();
})

function convertToMatrixMarket(nr, nc, data, indices, indptrs) {
    let triplets = [];
    for (var i = 0; i < nc; i++) {
        for (var j = indptrs[i]; j < indptrs[i+1]; j++) {
            triplets.push({ value: String(indices[j] + 1) + " " + String(i + 1) + " " + String(data[j]), order: Math.random() })
        }
    }
    triplets.sort((a, b) => a.order - b.order)
    let header = "%%\n" + String(nr) + " " + String(nc) + " " + String(data.length) + "\n";
    return header + triplets.map(x => x.value).join("\n")
}

test("simple initialization from MatrixMarket works correctly", () => {
    // Creating a CSC sparse matrix, spiking in big numbers every even row.
    let nr = 49;
    let nc = 23;
    const { data, indices, indptrs } = simulate.simulateSparseData(nc, nr, /* injectBigValues = */ true);

    const content = convertToMatrixMarket(nr, nc, data, indices, indptrs);
    const converter = new TextEncoder();
    var raw_buffer = converter.encode(content);
    var buffer = scran.createUint8WasmArray(raw_buffer.length);
    buffer.set(raw_buffer);

    var mat = scran.initializeSparseMatrixFromMatrixMarket(buffer, { layered: false });
    expect(mat.matrix.numberOfRows()).toBe(nr);
    expect(mat.matrix.numberOfColumns()).toBe(nc);
    expect(mat.row_ids).toBeNull();

    // Also works if we dump it into a file.
    const path = dir + "/test.mtx";
    fs.writeFileSync(path, content);
    var mat2 = scran.initializeSparseMatrixFromMatrixMarket(path, { layered: false });

    expect(mat2.matrix.numberOfRows()).toBe(nr);
    expect(mat2.matrix.numberOfColumns()).toBe(nc);
    expect(mat2.row_ids).toBeNull();

    // Works with layered matrices.
    var lmat = scran.initializeSparseMatrixFromMatrixMarket(buffer);
    let ids = lmat.row_ids;
    expect(ids.length).toBe(nr);
    var lmat2 = scran.initializeSparseMatrixFromMatrixMarket(path);
    expect(lmat2.row_ids.length).toBe(nr);

    expect(compare.equalArrays(ids, lmat2.row_ids)).toBe(true);
    expect(compare.areIndicesConsecutive(ids)).toBe(false);
    expect(compare.areIndicesConsecutive(ids.slice().sort())).toBe(true);

    // Same results compared to naive iteration.
    for (var c = 0; c < nc; c++) {
        let ref = new Array(nr);
        ref.fill(0);
        for (var j = indptrs[c]; j < indptrs[c+1]; j++) {
            ref[indices[j]] = data[j];
        }
        expect(compare.equalArrays(mat.matrix.column(c), ref)).toBe(true);
        expect(compare.equalArrays(mat2.matrix.column(c), ref)).toBe(true);

        let lref = new Array(nr);
        ids.forEach((x, i) => {
            lref[i] = ref[x];
        });
        expect(compare.equalArrays(lmat.matrix.column(c), lref)).toBe(true);
        expect(compare.equalArrays(lmat2.matrix.column(c), lref)).toBe(true);
    }

    // Inspection of dimensions works correctly.
    let deets = scran.extractMatrixMarketDimensions(path);
    expect(deets).toEqual({ rows: nr, columns: nc, lines: data.length });
    let deets2 = scran.extractMatrixMarketDimensions(buffer);
    expect(deets).toEqual(deets2);
 
    // Cleaning up.
    mat.matrix.free();
    mat2.matrix.free();
    buffer.free();
})

test("initialization from Gzipped MatrixMarket works correctly with Gzip", () => {
    var content = "%%\n11 5 6\n1 2 5\n10 3 2\n7 4 22\n5 1 12\n6 3 2\n1 5 8\n";
    const raw_buffer = pako.gzip(content);

    var buffer = scran.createUint8WasmArray(raw_buffer.length);
    buffer.set(raw_buffer);

    var mat = scran.initializeSparseMatrixFromMatrixMarket(buffer);
    expect(mat.matrix.numberOfRows()).toBe(11);
    expect(mat.matrix.numberOfColumns()).toBe(5);
    expect(mat.row_ids.length).toBe(11);

    expect(compare.equalArrays(mat.matrix.row(0), [0, 5, 0, 0, 8])).toBe(true);
    expect(compare.equalArrays(mat.matrix.column(2), [0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0])).toBe(true);
    
    // Just checking that the it's actually compressed.
    var mat2 = scran.initializeSparseMatrixFromMatrixMarket(buffer, { compressed: true });
    expect(mat2.matrix.numberOfRows()).toBe(11);
    expect(mat2.matrix.numberOfColumns()).toBe(5);
    expect(compare.equalArrays(mat2.matrix.row(4), mat.matrix.row(4))).toBe(true);

    // Also works if we dump it into a file.
    const path = dir + "/test.mtx.gz";
    fs.writeFileSync(path, buffer.array());
    var mat3 = scran.initializeSparseMatrixFromMatrixMarket(path);

    expect(mat3.matrix.numberOfRows()).toBe(11);
    expect(mat3.matrix.numberOfColumns()).toBe(5);
    expect(compare.equalArrays(mat3.matrix.row(5), mat.matrix.row(5))).toBe(true);

    // Cleaning up.
    mat.matrix.free();
    mat2.matrix.free();
    buffer.free();
})
