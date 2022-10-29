import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("column subset works", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);

    var subset = scran.subsetColumns(mat, [1,5,7]);
    expect(subset.numberOfRows()).toBe(20);
    expect(subset.numberOfColumns()).toBe(3);

    expect(compare.equalArrays(mat.column(0), subset.column(0))).toBe(false);
    expect(compare.equalArrays(mat.column(1), subset.column(0))).toBe(true);
    expect(compare.equalArrays(mat.column(5), subset.column(1))).toBe(true);
    expect(compare.equalArrays(mat.column(7), subset.column(2))).toBe(true);

    // Throws the right errors.
    expect(() => scran.subsetColumns(mat, [-1])).toThrow("non-negative");
    expect(() => scran.subsetColumns(mat, [10])).toThrow("number of columns");

    // Freeing all the bits and pieces.
    subset.free();
    mat.free();
});

test("row subset works", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);

    let keep = [1, 5, 7];
    var subset = scran.subsetRows(mat, keep);
    expect(subset.numberOfRows()).toBe(3);
    expect(subset.numberOfColumns()).toBe(10);

    expect(compare.equalArrays(mat.row(0), subset.row(0))).toBe(false);
    expect(compare.equalArrays(mat.row(1), subset.row(0))).toBe(true);
    expect(compare.equalArrays(mat.row(5), subset.row(1))).toBe(true);
    expect(compare.equalArrays(mat.row(7), subset.row(2))).toBe(true);

    // Throws the right errors.
    expect(() => scran.subsetRows(mat, [-1])).toThrow("non-negative");
    expect(() => scran.subsetRows(mat, [20])).toThrow("number of rows");

    // Freeing all the bits and pieces.
    mat.free();
    subset.free();
})

test("subsetting works in place", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);
    let ref7 = mat.row(7);

    let keep = [1, 5, 7];
    scran.subsetRows(mat, keep, { inPlace: true });
    expect(mat.numberOfRows()).toEqual(3);
    expect(mat.row(2)).toEqual(ref7);
    let ref4 = mat.column(4);

    let keep2 = [2, 4];
    scran.subsetColumns(mat, keep2, { inPlace: true });
    expect(mat.numberOfColumns()).toEqual(2);
    expect(mat.column(1)).toEqual(ref4);
})

test("splitRows works as expected", () => {
    let split = {
        A: [0, 3],
        B: [1, 5],
        C: [2, 4],
        D: [6]
    };

    var mat = simulate.simulateDenseMatrix(7, 10);
    let splitmats = scran.splitRows(mat, split);

    expect(splitmats.A.numberOfRows()).toBe(2);
    expect(splitmats.A.row(0)).toEqual(mat.row(0));
    expect(splitmats.A.row(1)).toEqual(mat.row(3));

    expect(splitmats.D.numberOfRows()).toBe(1);
    expect(splitmats.D.row(0)).toEqual(mat.row(6));

    // Works correctly if there's only one level.
    let solo_split = { X: [ 0, 1, 2, 3, 4, 5, 6 ] };
    expect(scran.splitRows(mat, solo_split, { singleNull: true })).toBeNull();

    let solomats = scran.splitRows(mat, solo_split);
    expect(solomats.X.numberOfRows()).toBe(mat.numberOfRows());
    expect(solomats.X.row(6)).toEqual(mat.row(6));

    // It's a clone, so it should be in a different address space.
    let new_ptr = solomats.X.matrix.$$.ptr;
    expect(new_ptr >= 0).toBe(true);
    let old_ptr = mat.matrix.$$.ptr;
    expect(old_ptr >= 0).toBe(true);
    expect(new_ptr).not.toBe(old_ptr);

    for (const v of Object.values(splitmats)) {
        v.free();
    }
    for (const v of Object.values(solomats)) {
        v.free();
    }

    // Ignores singleNull if it's not the right length and/or consecutive.
    solo_split = { X: [ 0, 1, 2, 3, 4, 5 ] };
    solomats = scran.splitRows(mat, solo_split, { singleNull: true }); 
    expect(solomats.X.numberOfRows()).toBe(6);

    solo_split = { X: [ 6, 0, 1, 2, 3, 4, 5 ] };
    solomats = scran.splitRows(mat, solo_split, { singleNull: true }); 
    expect(solomats.X.numberOfRows()).toBe(7);

    // Works when returning a MultiMatrix.
    let split2 = scran.splitRows(mat, split, { createMultiMatrix: true });
    expect(split2.available().sort()).toEqual(["A", "B", "C", "D"]);
    split2.free();

    mat.free();
})

