import * as scran from "../js/index.js";
import * as fs from "fs";
import * as compare from "./compare.js";
import * as hdf5 from "h5wasm";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
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

function mock_sparse_matrix(primary, secondary) {
    let data = [];
    let indices = [];
    let indptrs = new Uint32Array(primary + 1);
    indptrs[0] = 0;

    for (var i = 0; i < primary; i++) {
        indptrs[i+1] = indptrs[i];

        for (var j = 0; j < secondary; j++) {
            if (Math.random() < 0.05) { // 5% density
                data.push(Math.round(Math.random() * 10));
                indices.push(j);
                indptrs[i+1]++;
            }
        }
    }
        
    let data2 = new Uint16Array(data.length);
    data2.set(data);
    let indices2 = new Int32Array(indices.length);
    indices2.set(indices);
    let indptrs2 = new Uint32Array(indptrs.length);
    indptrs2.set(indptrs);

    return {
        "data": data2,
        "indices": indices2,
        "indptrs": indptrs2
    };
}

test("initialization from HDF5 works correctly with 10X inputs", () => {
    const path = dir + "/test.sparse_tenx.h5";
    purge(path);

    // Creating a CSC sparse matrix.
    let nr = 50;
    let nc = 20;
    const { data, indices, indptrs } = mock_sparse_matrix(nc, nr);

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

    // Checking that we can extract successfully.
    var first_col = mat.column(0);
    var ref = new Uint16Array(nr);
    for (var j = 0; j < indptrs[1]; j++) {
        ref[indices[j]] = data[j];
    }
    expect(compare.equalArrays(first_col, ref)).toBe(true);
})

test("initialization from HDF5 works correctly with H5AD inputs", () => {
    const path = dir + "/test.sparse_csr.h5";
    purge(path);

    // Creating a CSR sparse matrix.
    let nr = 100;
    let nc = 50;
    const { data, indices, indptrs } = mock_sparse_matrix(nr, nc);

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

