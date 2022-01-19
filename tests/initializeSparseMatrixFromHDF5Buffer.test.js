import * as scran from "../js/index.js";
import * as fs from "fs";
import * as compare from "./compare.js";

const datadir = "tests-data";
const testIfExists = (name) => fs.existsSync(datadir + "/" + name) ? test : test.skip;

beforeAll(async () => { await scran.initialize() });
afterAll(async () => { await scran.terminate() });

testIfExists("zeisel.dense.sub.h5")("initialization from HDF5 works correctly with dense inputs", () => {
    const name = "zeisel.dense.sub.h5";
    const path = datadir + "/" + name;
    var buffer = fs.readFileSync(path);

    var mat = scran.initializeSparseMatrixFromHDF5Buffer(buffer.buffer, "matrix");
    expect(mat.numberOfRows()).toBe(1000);
    expect(mat.numberOfColumns()).toBe(3005);

    var first_col = mat.column(0);
    expect(compare.equalArrays(first_col.slice(0, 5), [0, 3, 3, 0, 1])).toBe(true);
})

testIfExists("zeisel.tenx.sub.h5")("initialization from HDF5 works correctly with 10x inputs", () => {
    const name = "zeisel.tenx.sub.h5";
    const path = datadir + "/" + name;
    var buffer = fs.readFileSync(path);

    var mat = scran.initializeSparseMatrixFromHDF5Buffer(buffer.buffer, "matrix");
    expect(mat.numberOfRows()).toBe(1000);
    expect(mat.numberOfColumns()).toBe(3005);

    var first_col = mat.column(0);
    expect(compare.equalArrays(first_col.slice(0, 5), [0, 3, 3, 0, 1])).toBe(true);
})

testIfExists("zeisel.csc.sub.h5ad")("initialization from HDF5 works correctly with 10x inputs", () => {
    const name = "zeisel.csc.sub.h5ad";
    const path = datadir + "/" + name;
    var buffer = fs.readFileSync(path);

    var mat = scran.initializeSparseMatrixFromHDF5Buffer(buffer.buffer, "X");
    expect(mat.numberOfRows()).toBe(1000);
    expect(mat.numberOfColumns()).toBe(3005);

    var first_col = mat.column(0);
    expect(compare.equalArrays(first_col.slice(0, 5), [0, 3, 3, 0, 1])).toBe(true);
})
