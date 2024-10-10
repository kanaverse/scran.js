import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("per-cell QC metrics can be computed", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var qc = scran.perCellCrisprQcMetrics(mat);
    expect(qc.numberOfCells()).toBe(ncells);
    expect(qc.sum().length).toBe(ncells);
    expect(qc.detected().length).toBe(ncells);

    let mp = qc.maxProportion();
    expect(mp.length).toBe(ncells);
    let mi = qc.maxIndex();
    expect(mi.length).toBe(ncells);

    for (var c = 0; c < ncells; c++) {
        let col = mat.column(c);
        let maxed = col[mi[c]];

        col.sort((a, b) => a- b);
        expect(col[ngenes - 1]).toEqual(maxed);

        let sum = 0;
        col.forEach(x => { sum += x; });
        expect(mp[c]).toEqual(maxed/sum);
    }

    mat.free();
    qc.free();
});
