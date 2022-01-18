import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize() });
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
    var res = scran.scoreMarkers(norm, groups, block);

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
        expect(compare.equalArrays(res.means(group, 0), res1.means(group))).toBe(true);
        expect(compare.equalArrays(res.means(group, 1), res2.means(group))).toBe(true);
        expect(compare.equalArrays(res.detected(group, 0), res1.detected(group))).toBe(true);
        expect(compare.equalArrays(res.detected(group, 1), res2.detected(group))).toBe(true);
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
