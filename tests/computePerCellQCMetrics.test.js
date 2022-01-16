import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as scran from "../js/index.js";

test("per-cell QC metrics can be computed", () => {
    var mat = simulate.simulateMatrix(100, 20);
    var subs = simulate.simulateSubsets(100, 1);

    var qc = scran.computePerCellQCMetrics(mat, subs);
    expect(qc.sums().length).toBe(20);
    expect(qc.detected().length).toBe(20);
    expect(qc.subset_proportions(0).length).toBe(20);

    mat.free();
    qc.free();
});

test("per-cell QC metrics gets the same results with an input WasmArray", () => {
    var mat = simulate.simulateMatrix(100, 20);
    var subs = simulate.simulateSubsets(100, 2);
    var qc1 = scran.computePerCellQCMetrics(mat, subs);

    var wasmified = new scran.Uint8WasmArray(200);
    wasmified.array().set(subs[0]);
    wasmified.array().set(subs[1], 100);
    var qc2 = scran.computePerCellQCMetrics(mat, wasmified);

    expect(compare.equalArrays(qc1.sums(), qc2.sums())).toBe(true);
    expect(compare.equalArrays(qc1.detected(), qc2.detected())).toBe(true);
    expect(compare.equalArrays(qc1.subset_proportions(0), qc2.subset_proportions(0))).toBe(true);
    expect(compare.equalArrays(qc1.subset_proportions(1), qc2.subset_proportions(1))).toBe(true);

    mat.free();
    qc1.free();
    qc2.free();
    wasmified.free();
});
