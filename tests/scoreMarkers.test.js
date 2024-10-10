import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("scoreMarkers works as expected", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    var groups = [];
    for (var i = 0; i < ncells; i++) {
        groups.push(i % 3);
    }
    
    var output = scran.scoreMarkers(mat, groups);
    expect(output.numberOfGroups()).toBe(3);

    expect(output.mean(0).length).toBe(ngenes);
    expect(output.detected(1).length).toBe(ngenes);
    expect(output.cohensD(1).length).toBe(ngenes);
    expect(output.auc(2).length).toBe(ngenes);
    expect(output.deltaMean(0).length).toBe(ngenes);
    expect(output.deltaDetected(1).length).toBe(ngenes);

    // Fetch other types of summaries.
    expect(output.cohensD(0, { summary: "min-rank" }).length).toBe(ngenes);
    expect(() => output.cohensD(0, { summary: "foo" })).toThrow("foo");
    expect(() => output.cohensD(0, { summary: "median" })).toThrow("summary type 'median' not available");

    mat.free();
    norm.free();
    output.free();
});

test("scoreMarkers works with a log-fold change threshold", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    var groups = [];
    for (var i = 0; i < ncells; i++) {
        groups.push(i % 3);
    }

    // At a large threshold, all effects are negative.
    var output = scran.scoreMarkers(mat, groups, { threshold: 10 });
    expect(output.cohensD(1).some(x => (x > 0))).toBe(false);
    expect(output.auc(2).some(x => (x > 0.5))).toBe(false);

    // Everything else is the same.
    var ref = scran.scoreMarkers(mat, groups);
    expect(compare.equalFloatArrays(output.deltaMean(0), ref.deltaMean(0))).toBe(true);
    expect(compare.equalFloatArrays(output.mean(0), ref.mean(0))).toBe(true);

    mat.free();
    norm.free();
    output.free();
    ref.free();
});

test("scoreMarkers works after turning off AUCs", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    var groups = [];
    for (var i = 0; i < ncells; i++) {
        groups.push(i % 3);
    }

    var output = scran.scoreMarkers(mat, groups, { computeAuc: false });
    var ref = scran.scoreMarkers(mat, groups);

    for (var i = 0; i < 3; i++) {
        expect(compare.equalFloatArrays(output.deltaMean(i), ref.deltaMean(i))).toBe(true);
        expect(compare.equalFloatArrays(output.cohensD(i), ref.cohensD(i))).toBe(true);
        expect(compare.equalFloatArrays(output.mean(i), ref.mean(i))).toBe(true);
        expect(compare.equalFloatArrays(output.detected(i), ref.detected(i))).toBe(true);
    }

    expect(() => output.auc(0)).toThrow("no AUCs available"); 

    mat.free();
    norm.free();
    output.free();
    ref.free();
});

test("scoreMarkers works with maximum and medians", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    var groups = [];
    for (var i = 0; i < ncells; i++) {
        groups.push(i % 3);
    }

    var output = scran.scoreMarkers(mat, groups, { computeMaximum: true, computeMedian: true });
    expect(output.cohensD(2, { summary: "maximum" }).length).toEqual(ngenes);
    expect(output.auc(2, { summary: "median" }).length).toEqual(ngenes);
    expect(output.deltaMean(2, { summary: "maximum" }).length).toEqual(ngenes);
    expect(output.deltaDetected(2, { summary: "median" }).length).toEqual(ngenes);

    mat.free();
    norm.free();
    output.free();
})

test("scoreMarkers works as expected with blocking", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    var groups = [];
    for (var i = 0; i < ncells; i++) {
        groups.push(i % 2);
    }

    var block = new Array(ncells);
    var half = ncells / 2;
    block.fill(0, 0, half);
    block.fill(1, half, ncells);
    var res = scran.scoreMarkers(norm, groups, { block: block });

    // Comparing to manual blocking.
    var discard1 = new Array(ncells);
    discard1.fill(0, 0, half);
    discard1.fill(1, half, ncells);
    var sub1 = scran.filterCells(norm, discard1);
    var res1 = scran.scoreMarkers(sub1, groups.slice(0, half));

    var discard2 = new Array(ncells);
    discard2.fill(1, 0, half);
    discard2.fill(0, half, ncells);
    var sub2 = scran.filterCells(norm, discard2);
    var res2 = scran.scoreMarkers(sub2, groups.slice(half, ncells));

    // Comparing the results.
    for (var group = 0; group < 2; group++) {
        let averager = (x, y) => x.map((x, i) => (x + y[i])/2);
        expect(compare.equalFloatArrays(res.mean(group), averager(res1.mean(group), res2.mean(group)))).toBe(true);
        expect(compare.equalFloatArrays(res.detected(group), averager(res1.detected(group), res2.detected(group)))).toBe(true);
    }

    // Cleaning up.
    mat.free();
    norm.free();
    res.free();
    sub1.free();
    res1.free();
    sub2.free();
    res2.free();
});
