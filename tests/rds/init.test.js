import * as scran from "../../js/index.js";
import * as compare from "../compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

const maybe = process.env.CHECK_RDS ? test : test.skip;
const path = "tests/rds/"

function test_okayish(x, nr, nc, layered) {
    let mat = x.matrix;
    expect(mat.numberOfRows()).toBe(nr);
    expect(mat.numberOfColumns()).toBe(nc);

    if (layered) {
        expect(x.row_ids.length).toBe(nr);
    } else {
        expect(x.row_ids).toBeNull();
    }

    // Checking that we get something returned.
    let margins = 0;
    mat.row(0).forEach(y => { margins += y; });
    mat.row(nr - 1).forEach(y => { margins += y; });
    mat.column(0).forEach(y => { margins += y; });
    mat.column(nc - 1).forEach(y => { margins += y; });

    expect(margins).toBeGreaterThan(0);
}

maybe("works for integer matrix", () => {
    for (const layered of [ true, false ]) {
        let stuff = scran.readRds(path + "test2-integer-matrix.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("integer");

        let x = scran.initializeSparseMatrixFromRds(vals, { layered: layered });
        test_okayish(x, 50, 20, layered);

        x.matrix.free();
        vals.free();
        stuff.free();
    }
})

maybe("works for double matrix", () => {
    for (const layered of [ true, false ]) {
        let stuff = scran.readRds(path + "test2-double-matrix.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("double");

        let x = scran.initializeSparseMatrixFromRds(vals, { layered: layered });
        test_okayish(x, 100, 10, layered);

        x.matrix.free();
        vals.free();
        stuff.free();
    }
})

maybe("works for dgCMatrix", () => {
    for (const layered of [ true, false ]) {
        for (const cons of [ true, false ]) {
            let stuff = scran.readRds(path + "test2-dgCMatrix.rds");

            let vals = stuff.value();
            expect(vals.type()).toBe("S4");
            expect(vals.className()).toBe("dgCMatrix");

            let x = scran.initializeSparseMatrixFromRds(vals, { layered: layered, consume: cons });
            test_okayish(x, 70, 30, layered);

            x.matrix.free();
            vals.free();
            stuff.free();
        }
    }
})

maybe("works for dgTMatrix", () => {
    for (const layered of [ true, false ]) {
        for (const cons of [ true, false ]) {
            let stuff = scran.readRds(path + "test2-dgTMatrix.rds");

            let vals = stuff.value();
            expect(vals.type()).toBe("S4");
            expect(vals.className()).toBe("dgTMatrix");

            let x = scran.initializeSparseMatrixFromRds(vals, { layered: layered, consume: cons });
            test_okayish(x, 30, 70, layered);

            x.matrix.free();
            vals.free();
            stuff.free();
        }
    }
})
