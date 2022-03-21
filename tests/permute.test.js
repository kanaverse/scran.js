import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

function inverter(permute) {
    let inverse = restorer.slice();
    for (const [index, val] of restorer.entries()) {
        inverse[val] = index;
    }
    return inverse;
}

test("permutation of a vector works", () => {
    // Creating the source.
    let src = [];
    for (var i = 0; i < 20; i++) {
        src.push({ index: i, value: Math.random(), sort: Math.random() });
    }
    let original = src.map(x => x.value);

    let sorted = src.sort((a, b) => a.sort - b.sort);
    let permuted = sorted.map(x => x.value);
    let permutation = new Array(sorted.length);
    sorted.forEach((x, i) => {
        permutation[x.index] = i;
    });

    // Checking whether it is consistent.
    let permuted2 = scran.permuteVector(permutation, original);
    expect(compare.equalArrays(permuted, permuted2)).toBe(true);
})

test("permutation of a vector works with array inputs", () => {
    // Handles array inputs.
    let mat = simulate.simulatePermutedMatrix(50, 20);
    expect(mat.isPermuted()).toBe(true);

    let first = mat.column(0);
    let original = mat.permutation().map(i => first[i]);
    let redo = scran.permuteVector(mat, original);
    expect(compare.equalArrays(redo, first)).toBe(true);

    // No-op for non-permuted matrix.
    let dense = simulate.simulateDenseMatrix(50, 20);
    expect(dense.isPermuted()).toBe(false);

    first = dense.column(0);
    let noop = scran.permuteVector(dense, first);
    expect(compare.equalArrays(noop, first)).toBe(true);
});

test("unpermutation of a vector works", () => {
    // Creating the source.
    let src = [];
    for (var i = 0; i < 20; i++) {
        src.push({ index: i, value: Math.random(), sort: Math.random() });
    }
    let original = src.map(x => x.value);

    let sorted = src.sort((a, b) => a.sort - b.sort);
    let permuted = sorted.map(x => x.value);
    let permutation = new Array(sorted.length);
    sorted.forEach((x, i) => {
        permutation[x.index] = i;
    });

    // Checking whether it is consistent.
    let original2 = scran.unpermuteVector(permutation, permuted);
    expect(compare.equalArrays(original, original2)).toBe(true);
})

test("unpermutation of a vector works with array inputs", () => {
    // Handles array inputs.
    let mat = simulate.simulatePermutedMatrix(50, 20);
    expect(mat.isPermuted()).toBe(true);

    let first = mat.column(0);
    let original = mat.permutation().map(i => first[i]);
    let redo = scran.unpermuteVector(mat, first);
    expect(compare.equalArrays(redo, original)).toBe(true);

    // No-op for non-permuted matrix.
    let dense = simulate.simulateDenseMatrix(17, 20);
    expect(dense.isPermuted()).toBe(false);

    first = dense.column(0);
    let noop = scran.unpermuteVector(dense, first);
    expect(compare.equalArrays(noop, first)).toBe(true);
});

test("updating the permutation works", () => {
    // Creating the source.
    let src = [];
    for (var i = 0; i < 20; i++) {
        src.push({ index: i, value: Math.random(), sort1: Math.random(), sort2: Math.random() });
    }
    let original = src.map(x => x.value);

    let sorted = src.sort((a, b) => a.sort1 - b.sort1);
    let permuted1 = [];
    let permutation1 = new Array(sorted.length);
    sorted.forEach((x, i) => {
        permutation1[x.index] = i;
        permuted1.push(x.value);
    });

    sorted = src.sort((a, b) => a.sort2 - b.sort2);
    let permutation2 = new Array(sorted.length);
    let permuted2 = [];
    sorted.forEach((x, i) => {
        permutation2[x.index] = i;
        permuted2.push(x.value);
    });

    // Updating the permutation.
    let updator = scran.updatePermutation(permutation1, permutation2);

    let test = updator.map(x => permuted2[x]);
    expect(compare.equalArrays(test, permuted1)).toBe(true);
    
    // No-ops correctly.
    let updator2 = scran.updatePermutation(permutation1, permutation1);
    expect(updator2).toBe(null);
})

test("updating the permutation works for array inputs", () => {
    let mat = simulate.simulatePermutedMatrix(99, 20);
    expect(mat.isPermuted()).toBe(true);

    let linear = new Int32Array(mat.numberOfRows());
    linear.forEach((x, i) => { linear[i] = i; });

    let reperm = scran.updatePermutation(mat, linear);
    let reverse_perm = mat.permutation({ restore: false });
    expect(compare.equalArrays(reperm, reverse_perm)).toBe(true);

    // No-op for non-permuted matrix.
    let dense = simulate.simulateDenseMatrix(79, 20);
    expect(dense.isPermuted()).toBe(false);

    let linear2 = new Int32Array(dense.numberOfRows());
    linear2.forEach((x, i) => { linear2[i] = i; });

    let noop = scran.updatePermutation(dense, linear2);
    expect(noop).toBe(null);
});
