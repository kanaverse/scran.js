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
