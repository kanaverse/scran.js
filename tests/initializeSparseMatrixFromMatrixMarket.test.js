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

function convertToMatrixMarket(nr, nc, data, indices, indptrs) {
    let triplets = [];
    for (var i = 0; i < nc; i++) {
        for (var j = indptrs[i]; j < indptrs[i+1]; j++) {
            triplets.push({ value: String(indices[j] + 1) + " " + String(i + 1) + " " + String(data[j]), order: Math.random() })
        }
    }
    triplets.sort((a, b) => a.order - b.order)
    let header = "%%MatrixMarket matrix coordinate integer general\n" + String(nr) + " " + String(nc) + " " + String(data.length) + "\n";
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

    // Also works if we dump it into a file.
    const path = dir + "/test.mtx";
    fs.writeFileSync(path, content);
    var mat2 = scran.initializeSparseMatrixFromMatrixMarket(path, { layered: false });

    expect(mat2.numberOfRows()).toBe(nr);
    expect(mat2.numberOfColumns()).toBe(nc);

    // Works with layered matrices.
    var lmat = scran.initializeSparseMatrixFromMatrixMarket(buffer);
    var lmat2 = scran.initializeSparseMatrixFromMatrixMarket(path);

    // Same results compared to naive iteration.
    for (var c = 0; c < nc; c++) {
        let ref = new Array(nr);
        ref.fill(0);
        for (var j = indptrs[c]; j < indptrs[c+1]; j++) {
            ref[indices[j]] = data[j];
        }
        expect(compare.equalArrays(mat.column(c), ref)).toBe(true);
        expect(compare.equalArrays(mat2.column(c), ref)).toBe(true);
        expect(compare.equalArrays(lmat.column(c), ref)).toBe(true);
        expect(compare.equalArrays(lmat2.column(c), ref)).toBe(true);
    }

    // Inspection of dimensions works correctly.
    let deets = scran.extractMatrixMarketDimensions(path);
    expect(deets).toEqual({ rows: nr, columns: nc, lines: data.length });
    let deets2 = scran.extractMatrixMarketDimensions(buffer);
    expect(deets).toEqual(deets2);

    // Cleaning up.
    mat.free();
    lmat.free();
    mat2.free();
    lmat2.free();
    buffer.free();
})

test("initialization from Gzipped MatrixMarket works correctly with Gzip", () => {
    var content = "%%MatrixMarket matrix coordinate integer general\n11 5 6\n1 2 5\n10 3 2\n7 4 22\n5 1 12\n6 3 2\n1 5 8\n";
    const raw_buffer = pako.gzip(content);

    var buffer = scran.createUint8WasmArray(raw_buffer.length);
    buffer.set(raw_buffer);

    var mat = scran.initializeSparseMatrixFromMatrixMarket(buffer);
    expect(mat.numberOfRows()).toBe(11);
    expect(mat.numberOfColumns()).toBe(5);

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
