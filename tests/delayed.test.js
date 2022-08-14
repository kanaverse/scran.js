import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("scalar delayedArithmetic works correctly", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);
    let ref = mat.row(0);

    {
        let newmat = scran.delayedArithmetic(mat, "+", 5.5);
        let expected = ref.map(x => x + 5.5);
        expect(newmat.row(0)).toEqual(expected);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "*", 5.5);
        let expected = ref.map(x => x * 5.5);
        expect(newmat.row(0)).toEqual(expected);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "/", 5.5);
        let expected = ref.map(x => x / 5.5);
        expect(newmat.row(0)).toEqual(expected);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "/", 5.5, { right: false });
        let expected = ref.map(x => 5.5 / x);
        expect(newmat.row(0)).toEqual(expected);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "-", 5.5);
        let expected = ref.map(x => x - 5.5);
        expect(newmat.row(0)).toEqual(expected);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "-", 5.5, { right: false });
        let expected = ref.map(x => 5.5 - x);
        expect(newmat.row(0)).toEqual(expected);
        newmat.free();
    }

    mat.free();
})

test("vector delayedArithmetic works correctly for rows", () => {
    for (var mode = 0; mode < 3; mode++) {
        var mat;

        let options = {};
        if (mode == 0) {
            mat = simulate.simulateDenseMatrix(20, 10);
        } else if (mode == 1) {
            mat = simulate.simulatePermutedMatrix(50, 100);
        } else {
            mat = simulate.simulatePermutedMatrix(50, 100);
            options.isReorganized = false;
        }

        let other = [];
        for (var i = 1; i <= mat.numberOfRows(); i++) {
            other.push(i);
        }

        let refother = other;
        if (options.isReorganized === false) {
            let temp = [];
            mat.identities().forEach(x => {
                temp.push(other[x]);
            });
            refother = temp;
        }

        let refrow = mat.row(0);
        let refcol = mat.column(0);

        {
            let newmat = scran.delayedArithmetic(mat, "+", other, options);
            let exprow = refrow.map(x => x + refother[0]);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map((x, i) => x + refother[i]);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "*", other, options);
            let exprow = refrow.map(x => x * refother[0]);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map((x, i) => x * refother[i]);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "/", other, options);
            let exprow = refrow.map(x => x / refother[0]);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map((x, i) => x / refother[i]);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "/", other, { ...options, right: false });
            let exprow = refrow.map(x => refother[0] / x);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map((x, i) => refother[i] / x);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "-", other, options);
            let exprow = refrow.map(x => x - refother[0]);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map((x, i) => x - refother[i]);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "-", other, { ...options, right: false });
            let exprow = refrow.map(x => refother[0] - x);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map((x, i) => refother[i] - x);
            expect(newmat.column(0)).toEqual(expcol);
        }
    }
})

test("vector delayedArithmetic works correctly for columns", () => {
    for (var mode = 0; mode < 3; mode++) {
        var mat;

        let options = { along: "column" };
        if (mode == 0) {
            mat = simulate.simulateDenseMatrix(20, 10);
        } else if (mode == 1) {
            mat = simulate.simulatePermutedMatrix(50, 100);
        } else {
            mat = simulate.simulatePermutedMatrix(50, 100);
            options.isReorganized = false; // has no effect for columns!
        }

        let other = [];
        for (var i = 1; i <= mat.numberOfColumns(); i++) {
            other.push(i);
        }

        let refrow = mat.row(0);
        let refcol = mat.column(0);

        {
            let newmat = scran.delayedArithmetic(mat, "+", other, options);
            let exprow = refrow.map((x, i) => x + other[i]);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map(x => x + other[0]);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "*", other, options);
            let exprow = refrow.map((x, i) => x * other[i]);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map(x => x * other[0]);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "/", other, options);
            let exprow = refrow.map((x, i) => x / other[i]);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map(x => x / other[0]);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "/", other, { ...options, right: false });
            let exprow = refrow.map((x, i) => other[i] / x);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map(x => other[0] / x);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "-", other, options);
            let exprow = refrow.map((x, i) => x - other[i]);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map(x => x - other[0]);
            expect(newmat.column(0)).toEqual(expcol);
        }

        {
            let newmat = scran.delayedArithmetic(mat, "-", other, { ...options, right: false });
            let exprow = refrow.map((x, i) => other[i] - x);
            expect(newmat.row(0)).toEqual(exprow);
            let expcol = refcol.map(x => other[0] - x);
            expect(newmat.column(0)).toEqual(expcol);
        }
    }
})
