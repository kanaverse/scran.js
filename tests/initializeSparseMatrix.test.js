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
    expect(mat.isReorganized()).toBe(true);
    expect(mat.isSparse()).toBe(true);

    // Compare to a non-layered initialization.
    var mat2 = scran.initializeSparseMatrixFromDenseArray(nr, nc, vals, { layered: false });
    expect(mat2.numberOfRows()).toBe(nr);
    expect(mat2.numberOfColumns()).toBe(nc);
    expect(mat2.isReorganized()).toBe(false);
    expect(mat2.isSparse()).toBe(true);

    // Compare to a dense  initialization.
    var dense = scran.initializeDenseMatrixFromDenseArray(nr, nc, vals);
    expect(dense.numberOfRows()).toBe(nr);
    expect(dense.numberOfColumns()).toBe(nc);
    expect(dense.isReorganized()).toBe(false);
    expect(dense.isSparse()).toBe(false);

    // Properly column-major.
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
    expect(mat.numberOfRows()).toBe(11);
    expect(mat.numberOfColumns()).toBe(10);
    expect(mat.isReorganized()).toBe(false);
    expect(mat.isSparse()).toBe(true);

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

    let id_buffer = scran.createInt32WasmArray(11);
    expect(compare.equalArrays(ids, mat.identities({ buffer: id_buffer }))).toBe(true);

    // Checking the contents. 
    expect(compare.equalArrays(mat.row(0), [0, 0, 10, 10, 0, 0, 0, 0, 0, 0])).toBe(true); // basically gets row 2, which has been promoted to the first row.
    expect(compare.equalArrays(mat.row(9), [0, 0, 0, 1000, 0, 0, 0, 0, 0, 0])).toBe(true); // gets row 1, which has been demoted to the second-last row.
    expect(compare.equalArrays(mat.row(10), [0, 0, 1000000, 0, 0, 0, 0, 0, 0, 0])).toBe(true); // gets row 0, which has been demoted to the last row.

    // Cleaning up.
    vals.free();
    indices.free();
    indptrs.free();
    mat.free();
    id_buffer.free();
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
    expect(mat.numberOfRows()).toBe(nr);
    expect(mat.numberOfColumns()).toBe(nc);
    expect(mat.isReorganized()).toBe(false);

    // Also works if we dump it into a file.
    const path = dir + "/test.mtx";
    fs.writeFileSync(path, content);
    var mat2 = scran.initializeSparseMatrixFromMatrixMarket(path, { layered: false });

    expect(mat2.numberOfRows()).toBe(nr);
    expect(mat2.numberOfColumns()).toBe(nc);
    expect(mat2.isReorganized()).toBe(false);

    // Works with layered matrices.
    var lmat = scran.initializeSparseMatrixFromMatrixMarket(buffer);
    expect(lmat.isReorganized()).toBe(true);
    var lmat2 = scran.initializeSparseMatrixFromMatrixMarket(path);
    expect(lmat2.isReorganized()).toBe(true);
    let ids = lmat.identities();

    expect(compare.equalArrays(ids, lmat2.identities())).toBe(true);
    expect(compare.areIndicesConsecutive(ids)).toBe(false);
    expect(compare.areIndicesConsecutive(ids.slice().sort())).toBe(true);

    // Same results compared to naive iteration.
    for (var c = 0; c < nc; c++) {
        let ref = new Array(nr);
        ref.fill(0);
        for (var j = indptrs[c]; j < indptrs[c+1]; j++) {
            ref[indices[j]] = data[j];
        }
        expect(compare.equalArrays(mat.column(c), ref)).toBe(true);
        expect(compare.equalArrays(mat2.column(c), ref)).toBe(true);

        let lref = new Array(nr);
        ids.forEach((x, i) => {
            lref[i] = ref[x];
        });
        expect(compare.equalArrays(lmat.column(c), lref)).toBe(true);
        expect(compare.equalArrays(lmat2.column(c), lref)).toBe(true);
    }

    // Inspection of dimensions works correctly.
    let deets = scran.extractMatrixMarketDimensions(path);
    expect(deets).toEqual({ rows: nr, columns: nc, lines: data.length });
    let deets2 = scran.extractMatrixMarketDimensions(buffer);
    expect(deets).toEqual(deets2);
 
    // Cleaning up.
    mat.free();
    mat2.free();
    buffer.free();
})

test("initialization from Gzipped MatrixMarket works correctly with Gzip", () => {
    var content = "%%\n11 5 6\n1 2 5\n10 3 2\n7 4 22\n5 1 12\n6 3 2\n1 5 8\n";
    const raw_buffer = pako.gzip(content);

    var buffer = scran.createUint8WasmArray(raw_buffer.length);
    buffer.set(raw_buffer);

    var mat = scran.initializeSparseMatrixFromMatrixMarket(buffer);
    expect(mat.numberOfRows()).toBe(11);
    expect(mat.numberOfColumns()).toBe(5);
    expect(mat.isReorganized()).toBe(true);

    expect(compare.equalArrays(mat.row(0), [0, 5, 0, 0, 8])).toBe(true);
    expect(compare.equalArrays(mat.column(2), [0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0])).toBe(true);
    
    // Just checking that the it's actually compressed.
    var mat2 = scran.initializeSparseMatrixFromMatrixMarket(buffer, { compressed: true });
    expect(mat2.numberOfRows()).toBe(11);
    expect(mat2.numberOfColumns()).toBe(5);
    expect(compare.equalArrays(mat2.row(4), mat.row(4))).toBe(true);

    // Also works if we dump it into a file.
    const path = dir + "/test.mtx.gz";
    fs.writeFileSync(path, buffer.array());
    var mat3 = scran.initializeSparseMatrixFromMatrixMarket(path);

    expect(mat3.numberOfRows()).toBe(11);
    expect(mat3.numberOfColumns()).toBe(5);
    expect(compare.equalArrays(mat3.row(5), mat.row(5))).toBe(true);

    // Cleaning up.
    mat.free();
    mat2.free();
    buffer.free();
})
