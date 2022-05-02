import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("column subset works", () => {
    var mat1 = simulate.simulateDenseMatrix(20, 10);

    var subset = scran.subsetColumns(mat1, [1,5,7]);
    expect(subset.numberOfRows()).toBe(20);
    expect(subset.numberOfColumns()).toBe(3);

    expect(compare.equalArrays(mat1.column(0), subset.column(0))).toBe(false);
    expect(compare.equalArrays(mat1.column(1), subset.column(0))).toBe(true);
    expect(compare.equalArrays(mat1.column(5), subset.column(1))).toBe(true);
    expect(compare.equalArrays(mat1.column(7), subset.column(2))).toBe(true);

    // Throws the right errors.
    expect(() => scran.subsetColumns(mat1, [-1])).toThrow("non-negative");
    expect(() => scran.subsetColumns(mat1, [10])).toThrow("number of columns");

    // Preserves the identities.
    expect(subset.isPermuted()).toBe(false);

    var mat2 = simulate.simulatePermutedMatrix(20, 10);
    var subset2 = scran.subsetColumns(mat2, [1,5,7]);
    expect(subset2.isPermuted()).toBe(true);
    expect(compare.equalArrays(mat2.identities(), subset2.identities())).toBe(true);

    // Freeing all the bits and pieces.
    subset.free();
    mat1.free();
    subset2.free();
    mat2.free();
});

test("row subset works", () => {
    var mat1 = simulate.simulateDenseMatrix(20, 10);

    let keep = [1, 5, 7];
    var subset = scran.subsetRows(mat1, keep);
    expect(subset.numberOfRows()).toBe(3);
    expect(subset.numberOfColumns()).toBe(10);

    expect(compare.equalArrays(mat1.row(0), subset.row(0))).toBe(false);
    expect(compare.equalArrays(mat1.row(1), subset.row(0))).toBe(true);
    expect(compare.equalArrays(mat1.row(5), subset.row(1))).toBe(true);
    expect(compare.equalArrays(mat1.row(7), subset.row(2))).toBe(true);

    // Throws the right errors.
    expect(() => scran.subsetRows(mat1, [-1])).toThrow("non-negative");
    expect(() => scran.subsetRows(mat1, [20])).toThrow("number of rows");

    // Preserves the row identities.
    expect(subset.isPermuted()).toBe(true);
    expect(compare.equalArrays(subset.identities(), keep)).toBe(true);

    var mat2 = simulate.simulatePermutedMatrix(20, 10);
    var subset2 = scran.subsetRows(mat2, keep);
    expect(subset2.isPermuted()).toBe(true);
    let full = mat2.identities();
    let ids2 = keep.map(i => full[i]);
    expect(compare.equalArrays(ids2, subset2.identities())).toBe(true);

    // Freeing all the bits and pieces.
    mat1.free();
    subset.free();
    mat2.free();
    subset2.free();
})
