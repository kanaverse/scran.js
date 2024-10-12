import * as scran from "../../js/index.js";
import * as compare from "../compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

const maybe = process.env.CHECK_RDS ? test : test.skip;
const path = "tests/rds/"

function test_okayish(x, nr, nc, layered) {
    expect(x.numberOfRows()).toBe(nr);
    expect(x.numberOfColumns()).toBe(nc);

    // Checking that we get something returned.
    let margins = 0;
    x.row(0).forEach(y => { margins += y; });
    x.row(nr - 1).forEach(y => { margins += y; });
    x.column(0).forEach(y => { margins += y; });
    x.column(nc - 1).forEach(y => { margins += y; });

    expect(margins).toBeGreaterThan(0);
}

function expect_all(x, fun) {
    for (var c = 0; c < x.numberOfColumns(); c++) {
        expect(x.column(c).every(fun));
    }
}

function expect_any(x, fun) {
    let present = false;
    for (var c = 0; c < x.numberOfColumns(); c++) {
        if (x.column(c).some(fun)) {
            present = true;
            break;        
        }
    }
    expect(present).toBe(true);
}

maybe("works for integer matrix", () => {
    let stuff = scran.readRds(path + "test2-integer-matrix.rds");
    let vals = stuff.value();
    expect(vals.type()).toBe("integer");

    for (const layered of [ true, false ]) {
        let x = scran.initializeSparseMatrixFromRds(vals, { layered: layered });
        test_okayish(x, 50, 20, layered);
        expect_all(x, y => y%1 == 0);
        x.free();
    }

    // Automatically layers even if forceInteger=false.
    let x2 = scran.initializeSparseMatrixFromRds(vals, { forceInteger: false });
    expect_all(x2, y => y%1 == 0); // naturally integer.
    x2.free();

    vals.free();
    stuff.free();
})

maybe("works for double matrix", () => {
    let stuff = scran.readRds(path + "test2-double-matrix.rds");
    let vals = stuff.value();
    expect(vals.type()).toBe("double");

    for (const layered of [ true, false ]) {
        let x = scran.initializeSparseMatrixFromRds(vals, { layered: layered });
        test_okayish(x, 100, 10, layered);
        expect_all(x, y => y%1 == 0); // forced integers.
        x.free();
    }

    // Doesn't automatically layer when forceInteger=false.
    let x2 = scran.initializeSparseMatrixFromRds(vals, { forceInteger: false });
    expect_any(x2, y => y%1 > 0); // not forced integers.
    x2.free();

    vals.free();
    stuff.free();
})

maybe("works for dgCMatrix", () => {
    let rpath = path + "test2-dgCMatrix.rds";
    let stuff = scran.readRds(rpath);
    let vals = stuff.value();
    expect(vals.type()).toBe("S4");
    expect(vals.className()).toBe("dgCMatrix");

    for (const layered of [ true, false ]) {
        let x = scran.initializeSparseMatrixFromRds(vals, { layered: layered });
        expect_all(x, y => y%1 == 0); // forced integers.
        test_okayish(x, 70, 30, layered);

        x.free();
    }

    // Doesn't automatically layer when forceInteger=false.
    let x2 = scran.initializeSparseMatrixFromRds(vals, { forceInteger: false });
    expect_any(x2, y => y%1 > 0); // not forced integers.
    x2.free();

    vals.free();
    stuff.free();
})

maybe("works for dgTMatrix", () => {
    let rpath = path + "test2-dgTMatrix.rds";
    let stuff = scran.readRds(rpath);
    let vals = stuff.value();
    expect(vals.type()).toBe("S4");
    expect(vals.className()).toBe("dgTMatrix");

    for (const layered of [ true, false ]) {
        let x = scran.initializeSparseMatrixFromRds(vals, { layered: layered }); 
        test_okayish(x, 30, 70, layered);
        expect_all(x, y => y%1 == 0); // forced integers.

        x.free();
    }

    // Doesn't automatically layer when forceInteger=false.
    let x2 = scran.initializeSparseMatrixFromRds(vals, { forceInteger: false });
    expect_any(x2, y => y%1 > 0); // not forced integers.
    x2.free();

    vals.free();
    stuff.free();
})
