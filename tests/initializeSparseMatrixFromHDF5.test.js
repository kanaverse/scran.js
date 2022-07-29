import * as scran from "../js/index.js";
import * as fs from "fs";
import * as compare from "./compare.js";
import * as simulate from "./simulate.js";
import * as hdf5 from "h5wasm";

beforeAll(async () => { 
    await scran.initialize({ localFile: true });
    await hdf5.ready;
});

afterAll(async () => { await scran.terminate() });

const dir = "hdf5-test-files";
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

function purge(path) {
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
}

test("initialization from HDF5 works correctly with dense inputs", () => {
    const path = dir + "/test.dense.h5";
    purge(path);

    // Filling with random integers.
    let x = new Float64Array(1000);
    x.forEach((y, i) => {
        x[i] = Math.round(Math.random() * 10);
    });

    let f = new hdf5.File(path, "w");
    f.create_dataset("stuff", x, [20, 50]);
    f.close();
    
    // Ingesting it.
    var mat = scran.initializeSparseMatrixFromHDF5(path, "stuff");
    expect(mat.numberOfRows()).toBe(50); // Transposed; rows in HDF5 are typically samples.
    expect(mat.numberOfColumns()).toBe(20);

    // Checking that we're working in column-major (or row-major, in HDF5).
    var first_col = mat.column(0);
    expect(compare.equalArrays(first_col, x.slice(0, 50))).toBe(true);
})

test("initialization from HDF5 works correctly with 10X inputs", () => {
    const path = dir + "/test.sparse_tenx.h5";
    purge(path);

    // Creating a CSC sparse matrix, injecting in some big numbers.
    let nr = 50;
    let nc = 20;
    const { data, indices, indptrs } = simulate.simulateSparseData(nc, nr, /* injectBigValues = */ true);

    let f = new hdf5.File(path, "w");
    f.create_group("foobar");
    f.get("foobar").create_dataset("data", data);
    f.get("foobar").create_dataset("indices", indices);
    f.get("foobar").create_dataset("indptr", indptrs);
    f.get("foobar").create_dataset("shape", [nr, nc], null, "<i");
    f.close();

    // Ingesting it.
    var mat = scran.initializeSparseMatrixFromHDF5(path, "foobar");
    expect(mat.numberOfRows()).toBe(nr); 
    expect(mat.numberOfColumns()).toBe(nc);
    expect(mat.isReorganized()).toBe(true);

    let ids = mat.identities();
    expect(compare.areIndicesConsecutive(ids)).toBe(false);
    expect(compare.areIndicesConsecutive(ids.slice().sort())).toBe(true);

    var raw_mat = scran.initializeSparseMatrixFromHDF5(path, "foobar", { layered: false });
    expect(raw_mat.numberOfRows()).toBe(nr); 
    expect(raw_mat.numberOfColumns()).toBe(nc);
    expect(raw_mat.isReorganized()).toBe(false);

    // Checking that we can extract successfully.
    for (var c = 0; c < nc; c++) {
        var ref = new Array(nr);
        ref.fill(0);
        for (var j = indptrs[c]; j < indptrs[c+1]; j++) {
            ref[indices[j]] = data[j];
        }
        expect(compare.equalArrays(raw_mat.column(c), ref)).toBe(true);

        let lref = new Array(nr);
        ids.forEach((x, i) => {
            lref[i] = ref[x];
        });
        expect(compare.equalArrays(mat.column(c), lref)).toBe(true);
    }

    mat.free();
    raw_mat.free();
})

test("initialization from HDF5 works correctly with H5AD inputs", () => {
    const path = dir + "/test.sparse_csr.h5ad";
    purge(path);

    // Creating a CSR sparse matrix.
    let nr = 100;
    let nc = 50;
    const { data, indices, indptrs } = simulate.simulateSparseData(nr, nc);

    let f = new hdf5.File(path, "w");
    f.create_group("layers");
    f.get("layers").create_group("counts");
    f.get("layers/counts").create_attribute("shape", [nc, nr], null, "<i");
    f.get("layers/counts").create_attribute("encoding-type", "csc_matrix", Array(0), "S"); // this is CSC for H5AD but CSR for us.

    f.get("layers/counts").create_dataset("data", data);
    f.get("layers/counts").create_dataset("indices", indices);
    f.get("layers/counts").create_dataset("indptr", indptrs);
    f.close();

    // Ingesting it.
    var mat = scran.initializeSparseMatrixFromHDF5(path, "layers/counts");
    expect(mat.numberOfRows()).toBe(nr); 
    expect(mat.numberOfColumns()).toBe(nc);

    // Checking that we can extract successfully.
    var first_row = mat.row(0);
    var ref = new Uint16Array(nc);
    for (var j = 0; j < indptrs[1]; j++) {
        ref[indices[j]] = data[j];
    }
    expect(compare.equalArrays(first_row, ref)).toBe(true);
})

