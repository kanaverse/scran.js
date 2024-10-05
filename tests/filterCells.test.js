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

    var keep = filt.filter(qc);
    var sum = 0;
    keep.forEach(x => { sum += x; });
    expect(sum).toBeLessThan(keep.length);

    var filtered = scran.filterCells(mat, keep);
    expect(filtered.constructor.name).toBe("ScranMatrix");
    expect(filtered.numberOfColumns()).toBe(sum);

    mat.free();
    qc.free();
    filt.free();
    filtered.free();
})

test("filtered matrix is constructed as expected from a supplied array", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var keep = scran.createUint8WasmArray(ncells);
    var arr = keep.array();
    var count = 0;
    for (var i = 0; i < ncells; i++) {
        let choice = i % 3 == 0;
        arr[i] = choice;
        count += choice;
    }

    var filtered = scran.filterCells(mat, keep);
    expect(filtered.constructor.name).toBe("ScranMatrix");
    expect(filtered.numberOfColumns()).toBe(count);

    mat.free();
    keep.free();
    filtered.free();
})

