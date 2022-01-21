import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize() });
afterAll(async () => { await scran.terminate() });

test("per-cell QC metrics can be computed", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.computePerCellQCMetrics(mat, subs);
    expect(qc.sums().length).toBe(ncells);
    expect(qc.detected().length).toBe(ncells);
    expect(qc.subsetProportions(0).length).toBe(ncells);

    mat.free();
    qc.free();
});

test("per-cell QC metrics gets the same results with an input WasmArray", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 2);
    var qc1 = scran.computePerCellQCMetrics(mat, subs);

    var wasmified = new scran.Uint8WasmArray(ngenes * 2);
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
