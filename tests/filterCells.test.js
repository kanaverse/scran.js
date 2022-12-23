import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("filtered matrix is constructed as expected", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.perCellRnaQcMetrics(mat, subs);
    var filt = scran.suggestRnaQcFilters(qc, { numberOfMADs: 0 });

    var discard = filt.filter(qc);
    var sum = 0;
    discard.forEach(x => { sum += x; });
    expect(sum).toBeGreaterThan(0);

    var filtered = scran.filterCells(mat, discard);
    expect(filtered.constructor.name).toBe("ScranMatrix");
    expect(filtered.numberOfColumns()).toBe(ncells - sum);

    mat.free();
    qc.free();
    filt.free();
    filtered.free();
})

test("filtered matrix is constructed as expected from a supplied array", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var discard = scran.createUint8WasmArray(ncells);
    var arr = discard.array();
    var keep = 0;
    for (var i = 0; i < ncells; i++) {
        let lose = i % 3 == 0;
        arr[i] = lose;
        keep += !lose;
    }

    var filtered = scran.filterCells(mat, discard);
    expect(filtered.constructor.name).toBe("ScranMatrix");
    expect(filtered.numberOfColumns()).toBe(keep);

    mat.free();
    discard.free();
    filtered.free();
})

