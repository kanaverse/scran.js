import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("reorganization of a vector works", () => {
    // Creating the source.
    let src = [];
    for (var i = 0; i < 20; i++) {
        src.push({ index: i, value: Math.random(), sort: Math.random() });
    }
    let original = src.map(x => x.value);

    let sorted = src.sort((a, b) => a.sort - b.sort);
    let permuted = sorted.map(x => x.value);
    let reorganization = sorted.map(x => x.index);

    // Checking whether it is consistent.
    let permuted2 = scran.matchVectorToRowIdentities(reorganization, original);
    expect(compare.equalArrays(permuted, permuted2)).toBe(true);
})

test("reorganization of a vector works with ScranMatrix inputs", () => {
    // Handles array inputs.
    let mat = simulate.simulatePermutedMatrix(50, 20);
    expect(mat.isReorganized()).toBe(true);

    let ids = [];
    for (var i = 0; i < mat.numberOfRows(); i++) {
        ids.push(i);
    }
    let redo = scran.matchVectorToRowIdentities(mat, ids);
    expect(compare.equalArrays(mat.identities(), redo)).toBe(true);

    // No-op for non-permuted matrix.
    let dense = simulate.simulateDenseMatrix(50, 20);
    expect(dense.isReorganized()).toBe(false);

    let noop = scran.matchVectorToRowIdentities(dense, ids);
    expect(compare.equalArrays(noop, ids)).toBe(true);
});

test("updating the reorganization works", () => {
    // Creating the source.
    let src = [];
    for (var i = 0; i < 20; i++) {
        src.push({ index: i, value: Math.random(), sort1: Math.random(), sort2: Math.random() });
    }
    let original = src.map(x => x.value);

    let sorted = src.sort((a, b) => a.sort1 - b.sort1);
    let permuted1 = sorted.map(x => x.value);
    let ids1 = sorted.map(x => x.index);

    sorted = src.sort((a, b) => a.sort2 - b.sort2);
    let permuted2 = sorted.map(x => x.value);
    let ids2 = sorted.map(x => x.index);

    // Updating the reorganization.
    let updator = scran.updateRowIdentities(ids1, ids2);

    let test_ids = updator.map(x => ids2[x]);
    expect(compare.equalArrays(ids1, test_ids)).toBe(true);

    let test_vals = Array.from(updator).map(x => permuted2[x]);
    expect(compare.equalArrays(permuted1, test_vals)).toBe(true);
    
    // No-ops correctly when identities are the same.
    let updator2 = scran.updateRowIdentities(ids1, ids1);
    expect(updator2).toBe(null);
})

test("updating the reorganization works for ScranMatrix inputs", () => {
    let mat = simulate.simulatePermutedMatrix(99, 20);
    expect(mat.isReorganized()).toBe(true);

    let linear = new Int32Array(mat.numberOfRows());
    linear.forEach((x, i) => { linear[i] = i; });

    let reperm = scran.updateRowIdentities(mat, linear);
    let ids = mat.identities();
    expect(compare.equalArrays(reperm, ids)).toBe(true);

    // No-op for non-permuted matrix and old linear identities.
    let dense = simulate.simulateDenseMatrix(79, 20);
    expect(dense.isReorganized()).toBe(false);

    let linear2 = new Int32Array(dense.numberOfRows());
    linear2.forEach((x, i) => { linear2[i] = i; });

    let noop = scran.updateRowIdentities(dense, linear2);
    expect(noop).toBe(null);

    // No-op for non-permuted matrix with non-linear identities.
    let src = [];
    let original = [];
    for (var i = 0; i < dense.numberOfRows(); i++) {
        src.push({ index: i, sort: Math.random() });
    }

    let sorted = src.sort((a, b) => a.sort - b.sort);
    let random_ids = sorted.map(x => x.index);

    let perm = scran.updateRowIdentities(dense, random_ids);
    let rescue = perm.map(i => random_ids[i]);
    expect(compare.equalArrays(rescue, linear2)).toBe(true);
});
