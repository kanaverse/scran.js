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

    var qc = scran.perCellRnaQcMetrics(mat, subs);
    expect(qc.numberOfCells()).toBe(ncells);
    expect(qc.numberOfSubsets()).toBe(1);
    
    expect(qc.sums().length).toBe(ncells);
    expect(qc.detected().length).toBe(ncells);
    let prop = qc.subsetProportions(0);
    expect(prop.length).toBe(ncells);

    // Everything's still a proportion.
    let failures = 0;
    prop.forEach(x => { failures += (x < 0 || x > 1) }); 
    expect(failures).toBe(0);

    mat.free();
    qc.free();
});

test("per-cell QC metrics gets the same results with an input WasmArray", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 2);
    var qc1 = scran.perCellRnaQcMetrics(mat, subs);

    var wa1 = scran.createUint8WasmArray(ngenes);
    wa1.set(subs[0]);
    var wa2 = scran.createUint8WasmArray(ngenes);
    wa2.set(subs[1]);
    var qc2 = scran.perCellRnaQcMetrics(mat, [wa1, wa2]);

    expect(compare.equalArrays(qc1.sums(), qc2.sums())).toBe(true);
    expect(compare.equalArrays(qc1.detected(), qc2.detected())).toBe(true);
    expect(compare.equalArrays(qc1.subsetProportions(0), qc2.subsetProportions(0))).toBe(true);
    expect(compare.equalArrays(qc1.subsetProportions(1), qc2.subsetProportions(1))).toBe(true);

    mat.free();
    qc1.free();
    qc2.free();
    wa1.free();
    wa2.free();
});
