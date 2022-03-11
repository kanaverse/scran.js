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

    // Handles array inputs, though no permutation is involved for the simulated matrices.
    let mat = simulate.simulateMatrix(src.length, 20);
    let noop = scran.permuteVector(mat, original);
    expect(compare.equalArrays(noop, original)).toBe(true);
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

    // Handles array inputs, though no permutation is involved for the simulated matrices.
    let mat = simulate.simulateMatrix(src.length, 20);
    let noop = scran.unpermuteVector(mat, permuted);
    expect(compare.equalArrays(noop, permuted)).toBe(true);
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

    // Handles array inputs, though no permutation is involved for the simulated matrices.
    let mat = simulate.simulateMatrix(permutation1.length, 20);
    let noop = scran.updatePermutation(mat, permutation2);
    expect(compare.equalArrays(noop, permutation2)).toBe(true);
});

