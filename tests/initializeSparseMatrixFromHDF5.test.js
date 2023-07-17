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
    let x = new Int32Array(1000);
    x.forEach((y, i) => {
        x[i] = Math.round(Math.random() * 10);
    });

    let f = new hdf5.File(path, "w");
    f.create_dataset("stuff", x, [20, 50]);
    f.close();

    // Extracting details.
    let deets = scran.extractHDF5MatrixDetails(path, "stuff");
    expect(deets.format).toBe("dense");
    expect(deets.rows).toBe(50); // transposed, rows in HDF5 are typically samples.
    expect(deets.columns).toBe(20);
    expect(deets.integer).toBe(true);

    // Ingesting it.
    var mat = scran.initializeSparseMatrixFromHDF5(path, "stuff", { layered: false });
    expect(mat.matrix.numberOfRows()).toBe(50); // Transposed; rows in HDF5 are typically samples.
    expect(mat.matrix.numberOfColumns()).toBe(20);
    expect(mat.row_ids).toBeNull();

    // Checking that we're working in column-major (or row-major, in HDF5).
    var first_col = mat.matrix.column(0);
    expect(compare.equalArrays(first_col, x.slice(0, 50))).toBe(true);

    var last_col = mat.matrix.column(19);
    expect(compare.equalArrays(last_col, x.slice(19 * 50, 20 * 50))).toBe(true);

    // Integer status is automatically detected, allowing the layering to be attempted.
    var mat2 = scran.initializeSparseMatrixFromHDF5(path, "stuff", { forceInteger: false });
    expect(mat2.row_ids.length).toBe(50);

    // Freeing.
    mat.matrix.free();
})

test("dense initialization from HDF5 works correctly with forced integers", () => {
    const path = dir + "/test.dense.h5";
    purge(path);

    // Filling with random numbers.
    let x = new Float64Array(1000);
    x.forEach((y, i) => {
        x[i] = Math.random() * 10;
    });

    let f = new hdf5.File(path, "w");
    f.create_dataset("stuff", x, [25, 40]);
    f.close();

    let deets = scran.extractHDF5MatrixDetails(path, "stuff");
    expect(deets.integer).toBe(false);

    // Checking that non-integers are preserved.
    var mat = scran.initializeSparseMatrixFromHDF5(path, "stuff", { forceInteger: false });
    expect(mat.matrix.numberOfRows()).toBe(40); 
    expect(mat.matrix.numberOfColumns()).toBe(25);
    expect(mat.row_ids).toBeNull();

    var first_col = mat.matrix.column(0);
    let first_ref = x.slice(0, 40);
    expect(compare.equalArrays(first_col, first_ref)).toBe(true);

    var last_col = mat.matrix.column(24);
    let last_ref = x.slice(24 * 40, 25 * 40);
    expect(compare.equalArrays(last_col, last_ref)).toBe(true);

    // Coercing to integer.
    var mat2 = scran.initializeSparseMatrixFromHDF5(path, "stuff", { forceInteger: true, layered: false });

    var first_col = mat2.matrix.column(0);
    expect(compare.equalArrays(first_col, first_ref.map(Math.trunc))).toBe(true);

    var last_col = mat2.matrix.column(24);
    expect(compare.equalArrays(last_col, last_ref.map(Math.trunc))).toBe(true);

    // Freeing.
    mat.matrix.free();
    mat2.matrix.free();
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

    // Extracting details.
    let deets = scran.extractHDF5MatrixDetails(path, "foobar");
    expect(deets.format).toBe("csc");
    expect(deets.rows).toBe(50); 
    expect(deets.columns).toBe(20);
    expect(deets.integer).toBe(true);

    // Ingesting it.
    var mat = scran.initializeSparseMatrixFromHDF5(path, "foobar");
    expect(mat.matrix.numberOfRows()).toBe(nr); 
    expect(mat.matrix.numberOfColumns()).toBe(nc);
    expect(mat.row_ids.length).toBe(nr);

    let ids = mat.row_ids;
    expect(compare.areIndicesConsecutive(ids)).toBe(false);
    expect(compare.areIndicesConsecutive(ids.slice().sort())).toBe(true);

    var raw_mat = scran.initializeSparseMatrixFromHDF5(path, "foobar", { layered: false });
    expect(raw_mat.matrix.numberOfRows()).toBe(nr); 
    expect(raw_mat.matrix.numberOfColumns()).toBe(nc);
    expect(raw_mat.row_ids).toBeNull();

    // Checking that we can extract successfully.
    for (var c = 0; c < nc; c++) {
        var ref = new Array(nr);
        ref.fill(0);
        for (var j = indptrs[c]; j < indptrs[c+1]; j++) {
            ref[indices[j]] = data[j];
        }
        expect(compare.equalArrays(raw_mat.matrix.column(c), ref)).toBe(true);

        let lref = new Array(nr);
        ids.forEach((x, i) => {
            lref[i] = ref[x];
        });
        expect(compare.equalArrays(mat.matrix.column(c), lref)).toBe(true);
    }

    // Integer status is automatically detected, allowing the layering to be attempted.
    var mat2 = scran.initializeSparseMatrixFromHDF5(path, "foobar", { forceInteger: false });
    expect(mat2.row_ids.length).toBe(nr);

    // Freeing.
    mat.matrix.free();
    raw_mat.matrix.free();
    mat2.matrix.free();
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
    f.get("layers/counts").create_attribute("shape", [nc, nr], null, "<i"); // deliberately transposed, as CSC for H5AD is CSR for us.
    f.get("layers/counts").create_attribute("encoding-type", "csc_matrix", Array(0), "S"); // again, CSC for H5AD == CSR for us.

    f.get("layers/counts").create_dataset("data", data);
    f.get("layers/counts").create_dataset("indices", indices);
    f.get("layers/counts").create_dataset("indptr", indptrs);
    f.close();

    // Extracting details.
    let deets = scran.extractHDF5MatrixDetails(path, "layers/counts");
    expect(deets.format).toBe("csr");
    expect(deets.rows).toBe(nr);
    expect(deets.columns).toBe(nc);

    // Ingesting it.
    var mat = scran.initializeSparseMatrixFromHDF5(path, "layers/counts");
    expect(mat.matrix.numberOfRows()).toBe(nr); 
    expect(mat.matrix.numberOfColumns()).toBe(nc);

    // Checking that we can extract successfully.
    var first_row = mat.matrix.row(0);
    var ref = new Uint16Array(nc);
    for (var j = 0; j < indptrs[1]; j++) {
        ref[indices[j]] = data[j];
    }
    expect(compare.equalArrays(first_row, ref)).toBe(true);
})

test("initialization from HDF5 works correctly with forced integers", () => {
    const path = dir + "/test.sparse_tenx.h5";
    purge(path);

    // Creating a CSC sparse matrix, injecting in some big numbers.
    let nr = 50;
    let nc = 20;
    const { data, indices, indptrs } = simulate.simulateSparseData(nc, nr);
    let data2 = new Float64Array(data.length);
    data.forEach((y, i) => { data2[i] = y + 0.5; });

    let f = new hdf5.File(path, "w");
    f.create_group("foobar");
    f.get("foobar").create_dataset("data", data2);
    f.get("foobar").create_dataset("indices", indices);
    f.get("foobar").create_dataset("indptr", indptrs);
    f.get("foobar").create_dataset("shape", [nr, nc], null, "<i");
    f.close();

    let deets = scran.extractHDF5MatrixDetails(path, "foobar");
    expect(deets.integer).toBe(false);

    var mat1 = scran.initializeSparseMatrixFromHDF5(path, "foobar", { forceInteger: true, layered: false });
    expect(mat1.row_ids).toBeNull();
    var mat2 = scran.initializeSparseMatrixFromHDF5(path, "foobar", { forceInteger: false });
    expect(mat2.row_ids).toBeNull();

    for (var c = 0; c < nc; c++) {
        let col1 = mat1.matrix.column(c);
        let col2 = mat2.matrix.column(c);

        for (var r = 0; r < nr; ++r) {
            let x1 = col1[r];
            let x2 = col2[r];
            if (x2) {
                expect(x2 % 1).toBeGreaterThan(0);
                expect(x1).toBe(Math.trunc(x2));
            } else {
                expect(x1).toBe(0);
            }
        }
    }

    // Freeing.
    mat1.matrix.free();
    mat2.matrix.free();
})

test("initialization from HDF5 works correctly with subsetting", () => {
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

    // Loading various flavors into memory.
    var full = scran.initializeSparseMatrixFromHDF5(path, "foobar", { layered: false });

    let rs = [];
    for (var i = 1; i < nr; i += 2) {
        rs.push(i);
    }
    var row_sub = scran.initializeSparseMatrixFromHDF5(path, "foobar", { layered: false, subsetRow: rs });
    expect(row_sub.matrix.numberOfRows()).toEqual(rs.length);
    expect(row_sub.matrix.numberOfColumns()).toEqual(nc);

    let cs = [];
    for (var i = 0; i < nc; i += 2) {
        cs.push(i);
    }
    var col_sub = scran.initializeSparseMatrixFromHDF5(path, "foobar", { layered: false, subsetColumn: cs });
    expect(col_sub.matrix.numberOfRows()).toEqual(nr);
    expect(col_sub.matrix.numberOfColumns()).toEqual(cs.length);

    var both_sub = scran.initializeSparseMatrixFromHDF5(path, "foobar", { layered: false, subsetRow: rs, subsetColumn: cs });
    expect(both_sub.matrix.numberOfRows()).toEqual(rs.length);
    expect(both_sub.matrix.numberOfColumns()).toEqual(cs.length);

    // Checking the contents.
    for (var c = 0; c < nc; ++c) {
        let raw_ref = full.matrix.column(c);
        let ref = rs.map(i => raw_ref[i]);
        let sub = row_sub.matrix.column(c);
        expect(compare.equalFloatArrays(ref, sub)).toBe(true);
    }

    for (var r = 0; r < nr; ++r) {
        let raw_ref = full.matrix.row(r);
        let ref = cs.map(i => raw_ref[i]);
        let sub = col_sub.matrix.row(r);
        expect(compare.equalFloatArrays(ref, sub)).toBe(true);
    }

    for (var i = 0; i < rs.length; ++i) {
        let ref = col_sub.matrix.row(rs[i]);
        let sub = both_sub.matrix.row(i);
        expect(compare.equalFloatArrays(ref, sub)).toBe(true);
    }
})
