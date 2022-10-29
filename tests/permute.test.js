import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

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

test("updating the reorganization works with null", () => {
    let NR = 21;
    let linear = new Int32Array(NR);
    linear.forEach((x, i) => { linear[i] = i; });

    let noop = scran.updateRowIdentities(null, linear);
    expect(noop).toBe(null);

    // No-op for non-permuted matrix with non-linear identities.
    let src = [];
    let original = [];
    for (var i = 0; i < NR; i++) {
        src.push({ index: i, sort: Math.random() });
    }

    let sorted = src.sort((a, b) => a.sort - b.sort);
    let random_ids = sorted.map(x => x.index);

    let perm = scran.updateRowIdentities(null, random_ids);
    let rescue = perm.map(i => random_ids[i]);
    expect(compare.equalArrays(rescue, linear)).toBe(true);
});
