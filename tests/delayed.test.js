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

    expect(() => scran.delayedArithmetic(mat, "whee", 123)).toThrow("whee");

    mat.free();
})

test("vector delayedArithmetic works correctly for rows", () => {
    let mat = simulate.simulateDenseMatrix(20, 10);
    let other = [];
    for (var i = 1; i <= mat.numberOfRows(); i++) {
        other.push(i);
    }

    let refrow = mat.row(0);
    let refcol = mat.column(0);

    {
        let newmat = scran.delayedArithmetic(mat, "+", other);
        let exprow = refrow.map(x => x + other[0]);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map((x, i) => x + other[i]);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "*", other);
        let exprow = refrow.map(x => x * other[0]);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map((x, i) => x * other[i]);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "/", other);
        let exprow = refrow.map(x => x / other[0]);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map((x, i) => x / other[i]);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "/", other, { right: false });
        let exprow = refrow.map(x => other[0] / x);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map((x, i) => other[i] / x);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "-", other);
        let exprow = refrow.map(x => x - other[0]);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map((x, i) => x - other[i]);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "-", other, { right: false });
        let exprow = refrow.map(x => other[0] - x);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map((x, i) => other[i] - x);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    mat.free();
})

test("vector delayedArithmetic works correctly for columns", () => {
    let mat = simulate.simulateDenseMatrix(20, 10);
    let other = [];
    for (var i = 1; i <= mat.numberOfColumns(); i++) {
        other.push(i);
    }

    let refrow = mat.row(0);
    let refcol = mat.column(0);

    {
        let newmat = scran.delayedArithmetic(mat, "+", other, { along: "column" });
        let exprow = refrow.map((x, i) => x + other[i]);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map(x => x + other[0]);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "*", other, { along: "column" });
        let exprow = refrow.map((x, i) => x * other[i]);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map(x => x * other[0]);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "/", other, { along: "column" });
        let exprow = refrow.map((x, i) => x / other[i]);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map(x => x / other[0]);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "/", other, { along: "column", right: false });
        let exprow = refrow.map((x, i) => other[i] / x);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map(x => other[0] / x);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "-", other, { along: "column" });
        let exprow = refrow.map((x, i) => x - other[i]);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map(x => x - other[0]);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    {
        let newmat = scran.delayedArithmetic(mat, "-", other, { along: "column", right: false });
        let exprow = refrow.map((x, i) => other[i] - x);
        expect(newmat.row(0)).toEqual(exprow);
        let expcol = refcol.map(x => other[0] - x);
        expect(newmat.column(0)).toEqual(expcol);
        newmat.free();
    }

    mat.free();
})

test("delayed vector arith errors out correctly", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);

    let other = [];
    for (var i = 1; i <= mat.numberOfRows(); i++) {
        other.push(i);
    }

    expect(() => scran.delayedArithmetic(mat, "whee", other)).toThrow("whee");
    expect(() => scran.delayedArithmetic(mat, "+", [1,2,3])).toThrow("length");
})

test("delayedMath works correctly", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);
    let ref = mat.row(0);

    function almostequal (x, y) {
        if (x.length !== y.length){ 
            return false;
        }
        for (var i = 0; i < x.length; i++ ){
            let x_ = x[i];
            let y_ = y[i];
            if (Math.abs(x_ - y_) / (Math.abs(x_) + Math.abs(y_) + 0.00000001) > 0.00000001) {
                return false;
            }
        }
        return true;
    }

    {
        let newmat = scran.delayedMath(mat, "sqrt");
        let expected = ref.map(x => Math.sqrt(x));
        expect(almostequal(newmat.row(0), expected)).toBe(true);
        newmat.free();
    }

    {
        let newmat = scran.delayedMath(mat, "log1p");
        let expected = ref.map(x => Math.log1p(x));
        expect(almostequal(newmat.row(0), expected)).toBe(true);
        newmat.free();
    }

    {
        let newmat = scran.delayedMath(mat, "exp");
        let expected = ref.map(x => Math.exp(x));
        expect(almostequal(newmat.row(0), expected)).toBe(true);
        newmat.free();
    }

    {
        let newmat = scran.delayedMath(mat, "round");
        let expected = ref.map(x => Math.round(x));
        expect(almostequal(newmat.row(0), expected)).toBe(true);
        newmat.free();
    }

    {
        let newmat = scran.delayedMath(mat, "log");
        let expected = ref.map(x => Math.log(x));
        expect(almostequal(newmat.row(0), expected)).toBe(true);
        newmat.free();
    }

    {
        let newmat = scran.delayedMath(mat, "log", { logBase: 2 });
        let expected = ref.map(x => Math.log2(x));
        expect(almostequal(newmat.row(0), expected)).toBe(true);
        newmat.free();
    }

    expect(() => scran.delayedMath(mat, "whee")).toThrow("whee");

    mat.free();
})

test("in place editing works correctly", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);
    let ref = mat.row(0);

    scran.delayedArithmetic(mat, "-", 1.2, { inPlace: true });
    {
        let expected = ref.map(x => x - 1.2);
        expect(mat.row(0)).toEqual(expected);
    }

    scran.delayedMath(mat, "abs", { inPlace: true });
    {
        let expected = ref.map(x => Math.abs(x - 1.2));
        expect(mat.row(0)).toEqual(expected);
    }

    mat.free();
})
