import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("per-cell QC filters can be computed", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.perCellRnaQcMetrics(mat, subs);
    var filt = scran.suggestRnaQcFilters(qc);
    expect(filt.numberOfBlocks()).toEqual(1);
    expect(filt.numberOfSubsets()).toEqual(1);

    expect(filt.sum().length).toBe(1);
    expect(filt.detected().length).toBe(1);
    expect(filt.subsetProportion(0).length).toBe(1);

    // Computing filters.
    let keep = filt.filter(qc);
    expect(keep.length).toEqual(ncells);
    expect(keep instanceof Uint8Array).toBe(true);

    // Respects a pre-supplied buffer.
    {
        let buffer = scran.createUint8WasmArray(ncells);
        buffer.array()[0] = 100; // check it gets properly overwritten.

        filt.filter(qc, { buffer: buffer });
        expect(buffer.slice()).toEqual(keep);
        expect(buffer.array()[0]).toBeLessThan(2); 

        buffer.free();
    }

    // Force it to filter out something, just to check it's not a no-op.
    {
        var filt2 = scran.suggestRnaQcFilters(qc, { numberOfMADs: 0 });
        let keep2 = filt2.filter(qc);
        let sum2 = 0;
        keep2.forEach(x => { sum2 += x; });
        expect(sum2).toBeLessThan(keep2.length);
    }

    mat.free();
    qc.free();
    filt.free();
});

test("per-cell QC filters can be computed with blocking", () => {
    var ngenes = 100;
    var ncells = 1000;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);
   
    var block = scran.createInt32WasmArray(ncells);
    var half = ncells / 2;
    block.fill(0, 0, half);
    block.fill(1, half, ncells);

    // Computing with blocks.
    var qc = scran.perCellRnaQcMetrics(mat, subs);
    var filt = scran.suggestRnaQcFilters(qc, { block: block });
    expect(filt.numberOfBlocks()).toBe(2);

    // Filters throw if block is not supplied.
    expect(() => filt.filter(qc)).toThrow("'block' must be supplied");
    let keep = filt.filter(qc, { block: block });
    expect(keep.length).toEqual(ncells);

    // Computing manually.
    for (var b = 0; b < 2; b++) {
        let indices = [];
        let barr = block.array();
        for (var i = 0; i < ncells; i++) {
            if (barr[i] == b) {
                indices.push(i);
            }
        }

        let submat = scran.subsetColumns(mat, indices);
        var subqc = scran.perCellRnaQcMetrics(submat, subs);
        var subfilt = scran.suggestRnaQcFilters(subqc);

        expect(filt.sum()[b]).toEqual(subfilt.sum()[0]);
        expect(filt.detected()[b]).toEqual(subfilt.detected()[0]);
        expect(filt.subsetProportion(0)[b]).toEqual(subfilt.subsetProportion(0)[0]);

        let subdiscard = subfilt.filter(subqc);
        expect(Array.from(subdiscard)).toEqual(indices.map(i => keep[i]));

        // Cleaning up the mess.
        submat.free();
        subqc.free();
        subfilt.free();
    }

    // Continuing the clean-up.
    mat.free();
    qc.free();
    filt.free();
});

test("per-cell QC filters can be mocked up", () => {
    var nsubs = 2;
    var nblocks = 2;

    var qc = scran.emptySuggestRnaQcFiltersResults(nsubs, nblocks);
    expect(qc.numberOfSubsets()).toBe(2);

    for (const y of [ "sum", "detected" ]) {
        let x = qc[y]({ copy: false });
        expect(x.length).toEqual(nblocks);
        x[1] = 20;
        expect(qc[y]()[1]).toEqual(20);
    }
    
    for (var s = 0; s < nsubs; s++) {
        var x = qc.subsetProportion(s, { copy: false });
        expect(x.length).toBe(nblocks);
        x[0] = 0.9;
        expect(qc.subsetProportion(s)[0]).toEqual(0.9);
    }

    qc.free();
});
