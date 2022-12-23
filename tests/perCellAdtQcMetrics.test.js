import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("per-cell ADT-based QC metrics can be computed", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.perCellAdtQcMetrics(mat, subs);
    expect(qc.numberOfCells()).toBe(ncells);
    expect(qc.numberOfSubsets()).toBe(1);

    expect(qc.sums().length).toBe(ncells);
    expect(qc.detected().length).toBe(ncells);
    let tot = qc.subsetTotals(0);
    expect(tot.length).toBe(ncells);

    mat.free();
    qc.free();
});

test("per-cell QC ADT-based metrics can be mocked up", () => {
    var ncells = 100;
    var nsubs = 2;

    var qc = scran.emptyPerCellAdtQcMetricsResults(ncells, nsubs);
    expect(qc.numberOfSubsets()).toBe(2);

    for (const y of [ "sums", "detected" ]) {
        var x = qc[y]({copy: false});
        expect(x.length).toBe(ncells);
        x[0] = 100;
        var x2 = qc[y]();
        expect(x2[0]).toBe(100);
    }

    for (var s = 0; s < nsubs; s++) {
        var x = qc.subsetTotals(s, {copy: false});
        expect(x.length).toBe(ncells);
        x[10] = 0.5;
        var x2 = qc.subsetTotals(s);
        expect(x2[10]).toBe(0.5);
    }

    qc.free();
});
