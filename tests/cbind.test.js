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

    expect(compare.equalArrays(mat1.identities(), combined.identities())).toBe(true);
    expect(compare.equalArrays(mat1.column(0), combined.column(0))).toBe(true);
    expect(compare.equalArrays(mat2.column(0), combined.column(10))).toBe(true);
    expect(compare.equalArrays(mat3.column(0), combined.column(30))).toBe(true);

    // Freeing all the bits and pieces.
    combined.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

function unpermuteVector(mat, vals) {
    let ids = mat.identities();
    let copy = new vals.constructor(vals.length);
    for (const [i, p] of Object.entries(ids)) {
        copy[p] = vals[i];
    }
    return copy;
}

test("cbind works correctly when only first is permuted", () => {
    var mat1 = simulate.simulatePermutedMatrix(20, 10);
    var mat2 = simulate.simulateDenseMatrix(20, 20);
    var mat3 = simulate.simulateDenseMatrix(20, 30);

    var combined = scran.cbind([mat1, mat2, mat3]);
    expect(combined.isPermuted()).toBe(true);
    expect(combined.isSparse()).toBe(false);
    expect(combined.numberOfRows()).toBe(20);
    expect(combined.numberOfColumns()).toBe(60);

    expect(compare.equalArrays(mat1.identities(), combined.identities())).toBe(true);
    expect(compare.equalArrays(mat1.column(0), combined.column(0))).toBe(true);

    let out2 = unpermuteVector(combined, combined.column(10));
    expect(compare.equalArrays(mat2.column(0), out2)).toBe(true);

    let out3 = unpermuteVector(combined, combined.column(30));
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

    let out2 = unpermuteVector(mat2, mat2.column(0));
    expect(compare.equalArrays(combined.column(10), out2)).toBe(true);

    let out3 = unpermuteVector(mat3, mat3.column(0));
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

    expect(compare.equalArrays(mat1.identities(), combined.identities())).toBe(true);
    expect(compare.equalArrays(mat1.column(0), combined.column(0))).toBe(true);

    let ref2 = unpermuteVector(mat2, mat2.column(0));
    let out2 = unpermuteVector(combined, combined.column(10));
    expect(compare.equalArrays(out2, ref2)).toBe(true);
    
    let ref3 = unpermuteVector(mat3, mat3.column(0));
    let out3 = unpermuteVector(combined, combined.column(30));
    expect(compare.equalArrays(out3, ref3)).toBe(true);

    // Freeing all the bits and pieces.
    combined.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

test("cbindWithNames works correctly (simple)", () => {
    var mat1 = simulate.simulateDenseMatrix(10, 10);
    var names1 = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    var mat2 = simulate.simulateDenseMatrix(10, 20);
    var names2 = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    var mat3 = simulate.simulateDenseMatrix(10, 30);
    var names3 = ["E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

    let combined = scran.cbindWithNames([mat1, mat2, mat3], [names1, names2, names3]);
    expect(combined.matrix.isPermuted()).toBe(true);
    expect(combined.matrix.numberOfRows()).toBe(6);
    expect(combined.matrix.numberOfColumns()).toBe(60);

    expect(compare.equalArrays(combined.names, ["E", "F", "G", "H", "I", "J"])).toBe(true);
    expect(compare.equalArrays(combined.matrix.column(0), mat1.column(0).slice(4))).toBe(true);
    expect(compare.equalArrays(combined.matrix.column(10), mat2.column(0).slice(2, 8))).toBe(true);
    expect(compare.equalArrays(combined.matrix.column(30), mat3.column(0).slice(0, 6))).toBe(true);

    // Freeing all the bits and pieces.
    combined.matrix.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

test("cbindWithNames works correctly (complex)", () => {
    var mat1 = simulate.simulateDenseMatrix(10, 10);
    var names1 = ["Z", "X", "V", "T", "R", "P", "N", "L", "J", "H"]; // every second letter, from the end.
    var mat2 = simulate.simulateDenseMatrix(8, 20);
    var names2 = ["I", "J", "K", "L", "M", "N", "O", "P"]; // consecutive letters.
    var mat3 = simulate.simulateDenseMatrix(4, 30);
    var names3 = ["L", "J", "N", "P"]; // random order.

    let combined = scran.cbindWithNames([mat1, mat2, mat3], [names1, names2, names3]);
    expect(combined.matrix.isPermuted()).toBe(true);
    expect(combined.matrix.numberOfRows()).toBe(4);
    expect(combined.matrix.numberOfColumns()).toBe(60);

    expect(compare.equalArrays(combined.names, ["P", "N", "L", "J",])).toBe(true);
    expect(compare.equalArrays(combined.matrix.column(0), mat1.column(0).slice(5, 9))).toBe(true);

    let y2 = mat2.column(0);
    let expected2 = [y2[7], y2[5], y2[3], y2[1]];
    expect(compare.equalArrays(combined.matrix.column(10), expected2)).toBe(true);

    let y3 = mat3.column(0);
    let expected3 = [y3[3], y3[2], y3[0], y3[1]];
    expect(compare.equalArrays(combined.matrix.column(30), expected3)).toBe(true);

    // Row identities are handled correctly.
    expect(compare.equalArrays(combined.matrix.identities(), [5, 6, 7, 8])).toBe(true);

    // Freeing all the bits and pieces.
    combined.matrix.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

test("cbindWithNames works correctly (permuted)", () => {
    var mat1 = simulate.simulatePermutedMatrix(10, 10);
    var names1 = ["Z", "X", "V", "T", "R", "P", "N", "L", "J", "H"]; // every second letter, from the end.
    var mat2 = simulate.simulatePermutedMatrix(8, 20);
    var names2 = ["I", "J", "K", "L", "M", "N", "O", "P"]; // consecutive letters.
    var mat3 = simulate.simulatePermutedMatrix(4, 30);
    var names3 = ["L", "J", "N", "P"]; // random order.

    let combined = scran.cbindWithNames([mat1, mat2, mat3], [names1, names2, names3]);
    expect(combined.matrix.isPermuted()).toBe(true);
    expect(combined.matrix.numberOfRows()).toBe(4);
    expect(combined.matrix.numberOfColumns()).toBe(60);

    // Double-checking that the tests for the non-permuted case still hold here.
    expect(compare.equalArrays(combined.names, ["P", "N", "L", "J",])).toBe(true);
    expect(compare.equalArrays(combined.matrix.column(0), mat1.column(0).slice(5, 9))).toBe(true);

    let y2 = mat2.column(0);
    let expected2 = [y2[7], y2[5], y2[3], y2[1]];
    expect(compare.equalArrays(combined.matrix.column(10), expected2)).toBe(true);

    let y3 = mat3.column(0);
    let expected3 = [y3[3], y3[2], y3[0], y3[1]];
    expect(compare.equalArrays(combined.matrix.column(30), expected3)).toBe(true);

    // Row identities are handled correctly.
    let kept = [5, 6, 7, 8];
    let expected = kept.map(i => mat1.identities()[i]);
    expect(compare.equalArrays(combined.matrix.identities(), expected)).toBe(true);

    // Freeing all the bits and pieces.
    combined.matrix.free();
    mat1.free();
    mat2.free();
    mat3.free();
})
