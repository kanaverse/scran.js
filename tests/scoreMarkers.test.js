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
    expect(output.numberOfBlocks()).toBe(1);

    expect(output.means(0).length).toBe(ngenes);
    expect(output.detected(1).length).toBe(ngenes);
    expect(output.cohen(1).length).toBe(ngenes);
    expect(output.auc(2).length).toBe(ngenes);
    expect(output.lfc(0).length).toBe(ngenes);
    expect(output.deltaDetected(1).length).toBe(ngenes);

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
    var output = scran.scoreMarkers(mat, groups, { lfcThreshold: 10 });
    expect(output.cohen(1).some(x => (x > 0))).toBe(false);
    expect(output.auc(2).some(x => (x > 0.5))).toBe(false);

    // Everything else is the same.
    var ref = scran.scoreMarkers(mat, groups);
    expect(compare.equalFloatArrays(output.lfc(0), ref.lfc(0))).toBe(true);
    expect(compare.equalFloatArrays(output.means(0), ref.means(0))).toBe(true);

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
        expect(compare.equalFloatArrays(output.lfc(i), ref.lfc(i))).toBe(true);
        expect(compare.equalFloatArrays(output.cohen(i), ref.cohen(i))).toBe(true);
        expect(compare.equalFloatArrays(output.means(i), ref.means(i))).toBe(true);
        expect(compare.equalFloatArrays(output.detected(i), ref.detected(i))).toBe(true);
    }

    expect(() => output.auc(0)).toThrow("no AUCs computed"); 

    mat.free();
    norm.free();
    output.free();
    ref.free();
});

test("scoreMarkers works as expected with blocking", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    var groups = [];
    for (var i = 0; i < ncells; i++) {
        groups.push(i % 3);
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
    for (var group = 0; group < 3; group++) {
        expect(compare.equalArrays(res.means(group, { block: 0 }), res1.means(group))).toBe(true);
        expect(compare.equalArrays(res.means(group, { block: 1 }), res2.means(group))).toBe(true);
        expect(compare.equalArrays(res.detected(group, { block: 0 }), res1.detected(group))).toBe(true);
        expect(compare.equalArrays(res.detected(group, { block: 1 }), res2.detected(group))).toBe(true);

        // Checking that the average works as expected.
        let averager = (x, y) => x.map((x, i) => (x + y[i])/2);
        expect(compare.equalFloatArrays(res.means(group), averager(res1.means(group), res2.means(group)))).toBe(true);
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

test("ScoreMarkersResults can be mocked up", () => {
    let ngenes = 101;
    let ngroups = 3;

    // Unblocked.
    {
        let mock = scran.emptyScoreMarkersResults(ngenes, ngroups, 1);
        expect(mock.numberOfBlocks()).toBe(1);

        expect(() => mock.means()).toThrow("fillable");
        let means = mock.means(0, { fillable: true });
        means[0] = 100;
        means[100] = 1;

        let means2 = mock.means(0);
        expect(means2[0]).toBe(100);
        expect(means2[100]).toBe(1);

        expect(() => mock.auc(1)).toThrow("fillable");
        let auc = mock.auc(1, { fillable: true });
        auc[0] = 0.6;
        expect(mock.auc(1)[0]).toBe(0.6);
    }

    // Blocked.
    {
        let mock = scran.emptyScoreMarkersResults(ngenes, ngroups, 2);
        expect(mock.numberOfBlocks()).toBe(2);

        expect(() => mock.detected(1)).toThrow("fillable");
        let detected = mock.detected(1, { fillable: true });
        detected[0] = 100;
        detected[100] = 1;

        expect(() => mock.detected(1, { block: 0 })).toThrow("fillable");
        let detected_b = mock.detected(1, { block: 0, fillable: true });
        detected_b[0] = -100;
        detected_b[100] = -1;

        let detected2 = mock.detected(1);
        expect(detected2[0]).toBe(100);
        expect(detected2[100]).toBe(1);

        let detected_b2 = mock.detected(1, { block: 0 });
        expect(detected_b2[0]).toBe(-100);
        expect(detected_b2[100]).toBe(-1);

        expect(() => mock.auc(2)).toThrow("fillable");
        let cd = mock.cohen(2, { fillable: true });
        cd[0] = 0.5;
        cd[1] = -0.5;

        let cd2 = mock.cohen(2);
        expect(cd2[0]).toBe(0.5);
        expect(cd2[1]).toBe(-0.5);
    }

    // Skip the AUC calculation.
    {
        let mock = scran.emptyScoreMarkersResults(ngenes, ngroups, 1, { computeAuc: false });
        expect(() => mock.auc(1, { fillable: true })).toThrow("AUC");
    }
})
