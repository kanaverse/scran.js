import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("cbind works correctly without permutation", () => {
    var mat1 = simulate.simulateDenseMatrix(20, 10);
    var mat2 = simulate.simulateDenseMatrix(20, 20);
    var mat3 = simulate.simulateDenseMatrix(20, 30);

    var combined = scran.cbind([mat1, mat2, mat3]);
    expect(combined.isPermuted()).toBe(false);
    expect(combined.isSparse()).toBe(false);
    expect(combined.numberOfRows()).toBe(20);
    expect(combined.numberOfColumns()).toBe(60);

    expect(compare.equalArrays(mat1.column(0), combined.column(0))).toBe(true);
    expect(compare.equalArrays(mat2.column(0), combined.column(10))).toBe(true);
    expect(compare.equalArrays(mat3.column(0), combined.column(30))).toBe(true);

    // Freeing all the bits and pieces.
    combined.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

test("cbind can ignore permutations", () => {
    var mat1 = simulate.simulatePermutedMatrix(20, 10);
    var mat2 = simulate.simulatePermutedMatrix(20, 20);
    var mat3 = simulate.simulatePermutedMatrix(20, 30);

    var combined = scran.cbind([mat1, mat2, mat3], { assumeSame: true });
    expect(combined.isPermuted()).toBe(true);
    expect(combined.isSparse()).toBe(true);
    expect(combined.numberOfRows()).toBe(20);
    expect(combined.numberOfColumns()).toBe(60);

    expect(compare.equalArrays(mat1.permutation(), combined.permutation())).toBe(true);
    expect(compare.equalArrays(mat1.column(0), combined.column(0))).toBe(true);
    expect(compare.equalArrays(mat2.column(0), combined.column(10))).toBe(true);
    expect(compare.equalArrays(mat3.column(0), combined.column(30))).toBe(true);

    // Freeing all the bits and pieces.
    combined.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

test("cbind works correctly when only first is permuted", () => {
    var mat1 = simulate.simulatePermutedMatrix(20, 10);
    var mat2 = simulate.simulateDenseMatrix(20, 20);
    var mat3 = simulate.simulateDenseMatrix(20, 30);

    var combined = scran.cbind([mat1, mat2, mat3]);
    expect(combined.isPermuted()).toBe(true);
    expect(combined.isSparse()).toBe(false);
    expect(combined.numberOfRows()).toBe(20);
    expect(combined.numberOfColumns()).toBe(60);

    expect(compare.equalArrays(mat1.permutation(), combined.permutation())).toBe(true);
    expect(compare.equalArrays(mat1.column(0), combined.column(0))).toBe(true);

    let out2 = scran.unpermuteVector(combined, combined.column(10));
    expect(compare.equalArrays(mat2.column(0), out2)).toBe(true);

    let out3 = scran.unpermuteVector(combined, combined.column(30));
    expect(compare.equalArrays(mat3.column(0), out3)).toBe(true);

    // Freeing all the bits and pieces.
    combined.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

test("cbind works correctly when only first is not-permuted", () => {
    var mat1 = simulate.simulateDenseMatrix(20, 10);
    var mat2 = simulate.simulatePermutedMatrix(20, 20);
    var mat3 = simulate.simulatePermutedMatrix(20, 30);

    var combined = scran.cbind([mat1, mat2, mat3]);
    expect(combined.isPermuted()).toBe(false);
    expect(combined.numberOfRows()).toBe(20);
    expect(combined.numberOfColumns()).toBe(60);

    expect(compare.equalArrays(mat1.column(0), combined.column(0))).toBe(true);

    let out2 = scran.unpermuteVector(mat2, mat2.column(0));
    expect(compare.equalArrays(combined.column(10), out2)).toBe(true);

    let out3 = scran.unpermuteVector(mat3, mat3.column(0));
    expect(compare.equalArrays(combined.column(30), out3)).toBe(true);

    // Freeing all the bits and pieces.
    combined.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

test("cbind works correctly when everyone is permuted", () => {
    var mat1 = simulate.simulatePermutedMatrix(20, 10);
    var mat2 = simulate.simulatePermutedMatrix(20, 20);
    var mat3 = simulate.simulatePermutedMatrix(20, 30);

    var combined = scran.cbind([mat1, mat2, mat3]);
    expect(combined.isPermuted()).toBe(true);
    expect(combined.isSparse()).toBe(true);
    expect(combined.numberOfRows()).toBe(20);
    expect(combined.numberOfColumns()).toBe(60);

    expect(compare.equalArrays(mat1.permutation(), combined.permutation())).toBe(true);
    expect(compare.equalArrays(mat1.column(0), combined.column(0))).toBe(true);

    let ref2 = scran.unpermuteVector(mat2, mat2.column(0));
    let out2 = scran.unpermuteVector(combined, combined.column(10));
    expect(compare.equalArrays(out2, ref2)).toBe(true);
    
    let ref3 = scran.unpermuteVector(mat3, mat3.column(0));
    let out3 = scran.unpermuteVector(combined, combined.column(30));
    expect(compare.equalArrays(out3, ref3)).toBe(true);

    // Freeing all the bits and pieces.
    combined.free();
    mat1.free();
    mat2.free();
    mat3.free();
})
