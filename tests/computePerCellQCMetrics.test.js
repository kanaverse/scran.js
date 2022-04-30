import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("per-cell QC metrics can be computed", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.computePerCellQCMetrics(mat, subs);
    expect(qc.sums().length).toBe(ncells);
    expect(qc.detected().length).toBe(ncells);
    let prop = qc.subsetProportions(0);
    expect(prop.length).toBe(ncells);

    // Everything's still a proportion.
    expect(qc.isProportion()).toBe(true);
    let failures = 0;
    prop.forEach(x => { failures += (x < 0 || x > 1) }); 
    expect(failures).toBe(0);

    mat.free();
    qc.free();
});

test("subset totals can be computed", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.computePerCellQCMetrics(mat, subs, { subsetProportions: false });
    let prop = qc.subsetProportions(0);

    // Not a proportion anymore!
    expect(qc.isProportion()).toBe(false);
    let has_big = 0;
    prop.forEach(x => { has_big += (x > 1) }); 
    expect(has_big).toBeGreaterThan(0);
});

test("per-cell QC metrics gets the same results with an input WasmArray", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 2);
    var qc1 = scran.computePerCellQCMetrics(mat, subs);

    var wasmified = scran.createUint8WasmArray(ngenes * 2);
    wasmified.array().set(subs[0]);
    wasmified.array().set(subs[1], ngenes);
    var qc2 = scran.computePerCellQCMetrics(mat, wasmified);

    expect(compare.equalArrays(qc1.sums(), qc2.sums())).toBe(true);
    expect(compare.equalArrays(qc1.detected(), qc2.detected())).toBe(true);
    expect(compare.equalArrays(qc1.subsetProportions(0), qc2.subsetProportions(0))).toBe(true);
    expect(compare.equalArrays(qc1.subsetProportions(1), qc2.subsetProportions(1))).toBe(true);

    mat.free();
    qc1.free();
    qc2.free();
    wasmified.free();
});

test("per-cell QC metrics can be mocked up", () => {
    var ngenes = 100;
    var nsubs = 2;

    var qc = scran.emptyPerCellQCMetricsResults(ngenes, nsubs);
    expect(qc.numberOfSubsets()).toBe(2);

    for (const y of [ "sums", "detected" ]) {
        var x = qc[y]({copy: false});
        expect(x.length).toBe(ngenes);
        x[0] = 100;
        var x2 = qc[y]();
        expect(x2[0]).toBe(100);
    }

    for (var s = 0; s < nsubs; s++) {
        var x = qc.subsetProportions(s, {copy: false});
        expect(x.length).toBe(ngenes);
        x[10] = 0.5;
        var x2 = qc.subsetProportions(s);
        expect(x2[10]).toBe(0.5);
    }

    qc.free();
});
