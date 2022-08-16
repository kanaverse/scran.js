import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("cbind works correctly", () => {
    var mat1 = simulate.simulateDenseMatrix(20, 10);
    var mat2 = simulate.simulateDenseMatrix(20, 20);
    var mat3 = simulate.simulateDenseMatrix(20, 30);

    var combined = scran.cbind([mat1, mat2, mat3]);
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

test("cbindWithNames works correctly (simple)", () => {
    var mat1 = simulate.simulateDenseMatrix(10, 10);
    var names1 = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    var mat2 = simulate.simulateDenseMatrix(10, 20);
    var names2 = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    var mat3 = simulate.simulateDenseMatrix(10, 30);
    var names3 = ["E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

    let combined = scran.cbindWithNames([mat1, mat2, mat3], [names1, names2, names3]);
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

function quick_check(mat1, mat2, mat3, combined) {
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
}

test("cbindWithNames works correctly (complex)", () => {
    var mat1 = simulate.simulateDenseMatrix(10, 10);
    var names1 = ["Z", "X", "V", "T", "R", "P", "N", "L", "J", "H"]; // every second letter, from the end.
    var mat2 = simulate.simulateDenseMatrix(8, 20);
    var names2 = ["I", "J", "K", "L", "M", "N", "O", "P"]; // consecutive letters.
    var mat3 = simulate.simulateDenseMatrix(4, 30);
    var names3 = ["L", "J", "N", "P"]; // random order.

    let combined = scran.cbindWithNames([mat1, mat2, mat3], [names1, names2, names3]);
    quick_check(mat1, mat2, mat3, combined);

    // Freeing all the bits and pieces.
    combined.matrix.free();
    mat1.free();
    mat2.free();
    mat3.free();
})

test("cbindWithNames works correctly (duplicates)", () => {
    var mat1 = simulate.simulateDenseMatrix(10, 10);
    var names1 = ["Z", "A", "Z", "A", "R", "P", "N", "L", "J", "H"]; // preceding duplicates that might mess with the indexing.
    var mat2 = simulate.simulateDenseMatrix(8, 20);
    var names2 = ["I", "J", "K", "L", "M", "N", "P", "P"]; // duplicate in 'P', the last occurrence is used.
    var mat3 = simulate.simulateDenseMatrix(4, 30);
    var names3 = ["L", "J", "N", "P"]; 

    let combined = scran.cbindWithNames([mat1, mat2, mat3], [names1, names2, names3]);
    quick_check(mat1, mat2, mat3, combined);

    // Freeing all the bits and pieces.
    combined.matrix.free();
    mat1.free();
    mat2.free();
    mat3.free();
})
