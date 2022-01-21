import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize() });
afterAll(async () => { await scran.terminate() });

test("filtered matrix is constructed as expected", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.computePerCellQCMetrics(mat, subs);
    var filt = scran.computePerCellQCFilters(qc);

    var discard = filt.discardOverall();
    var sum = 0;
    discard.forEach(x => { sum += x; });

    var filtered = scran.filterCells(mat, filt);
    expect(filtered.constructor.name).toBe("LayeredSparseMatrix");
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

    var discard = new scran.Uint8WasmArray(ncells);
    var arr = discard.array();
    var keep = 0;
    for (var i = 0; i < ncells; i++) {
        let lose = i % 3 == 0;
        arr[i] = lose;
        keep += !lose;
    }

    var filtered = scran.filterCells(mat, discard);
    expect(filtered.constructor.name).toBe("LayeredSparseMatrix");
    expect(filtered.numberOfColumns()).toBe(keep);

    mat.free();
    discard.free();
    filtered.free();
})

