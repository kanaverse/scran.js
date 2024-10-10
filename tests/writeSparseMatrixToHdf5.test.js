import * as scran from "../js/index.js";
import * as fs from "fs";
import * as simulate from "./simulate.js";

beforeAll(async () => await scran.initialize({ localFile: true }));
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

test("saving a sparse matrix to HDF5 works correctly for 10X", () => {
    const path = dir + "/test.sparse.out.h5";

    let simmed = simulate.simulateMatrix(100, 200);

    purge(path);
    scran.writeSparseMatrixToHdf5(simmed, path, "foo", { format: "tenx_matrix" });

    let output = scran.initializeScranMatrixFromHdf5(path, "foo", { layered: false });
    expect(output.numberOfRows()).toEqual(simmed.numberOfRows());
    expect(output.numberOfColumns()).toEqual(simmed.numberOfColumns());

    for (var i = 0; i < simmed.numberOfColumns(); i++) {
        expect(simmed.column(i)).toEqual(output.column(i));
    }
})

test("saving a sparse matrix to HDF5 works correctly for H5AD-derivatives", () => {
    const path = dir + "/test.sparse.out.h5";

    let simmed = simulate.simulateMatrix(80, 50);

    // csc_matrix.
    {
        purge(path);
        scran.writeSparseMatrixToHdf5(simmed, path, "foo", { format: "csc_matrix" });

        let output = scran.initializeScranMatrixFromHdf5(path, "foo", { layered: false });
        expect(output.numberOfRows()).toEqual(simmed.numberOfRows());
        expect(output.numberOfColumns()).toEqual(simmed.numberOfColumns());

        let ghandle = new scran.H5Group(path, "foo");
        expect(ghandle.readAttribute("encoding-type").values[0]).toEqual("csc_matrix");
        expect(ghandle.readAttribute("shape").values).toEqual(new Int32Array([50, 80]));

        for (var i = 0; i < simmed.numberOfColumns(); i++) {
            expect(simmed.column(i)).toEqual(output.column(i));
        }
    }

    // Now for the csr_matrix.
    {
        purge(path);
        scran.writeSparseMatrixToHdf5(simmed, path, "foo", { format: "csr_matrix" });

        let output = scran.initializeScranMatrixFromHdf5(path, "foo", { layered: false });
        expect(output.numberOfRows()).toEqual(simmed.numberOfRows());
        expect(output.numberOfColumns()).toEqual(simmed.numberOfColumns());

        let ghandle = new scran.H5Group(path, "foo");
        expect(ghandle.readAttribute("encoding-type").values[0]).toEqual("csr_matrix");
        expect(ghandle.readAttribute("shape").values).toEqual(new Int32Array([50, 80]));

        for (var i = 0; i < simmed.numberOfColumns(); i++) {
            expect(simmed.column(i)).toEqual(output.column(i));
        }
    }
})

test("saving a sparse matrix to HDF5 works correctly when forcing integers", () => {
    const path = dir + "/test.sparse.out.h5";

    let simmed = simulate.simulateMatrix(50, 80, /* density */ 0.2, /* maxcount */ 10, /* forceInteger */ false);

    purge(path);
    scran.writeSparseMatrixToHdf5(simmed, path, "foo", { forceInteger: true });

    let output = scran.initializeScranMatrixFromHdf5(path, "foo", { layered: false });
    expect(output.numberOfRows()).toEqual(simmed.numberOfRows());
    expect(output.numberOfColumns()).toEqual(simmed.numberOfColumns());

    for (var i = 0; i < simmed.numberOfColumns(); i++) {
        let original = simmed.column(i);
        let expected = original.map(Math.floor);
        expect(expected).not.toEqual(original);
        expect(output.column(i)).toEqual(expected);
    }
})
