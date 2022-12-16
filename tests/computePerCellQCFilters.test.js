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

    var qc = scran.computePerCellQCMetrics(mat, subs);
    var filt = scran.computePerCellQCFilters(qc);

    expect(filt.discardSums().length).toBe(ncells);
    expect(filt.discardDetected().length).toBe(ncells);
    expect(filt.discardSubsetProportions(0).length).toBe(ncells);

    expect(filt.thresholdsSums().length).toBe(1);
    expect(filt.thresholdsDetected().length).toBe(1);
    expect(filt.thresholdsSubsetProportions(0).length).toBe(1);

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
    var qc = scran.computePerCellQCMetrics(mat, subs);
    var filt = scran.computePerCellQCFilters(qc, { block: block });

    // Computing manually.
    var dense_buffer = scran.createFloat64WasmArray(ngenes * half);

    for (var c = 0; c < half; c++) {
        let out = mat.column(c);
        dense_buffer.array().set(out, c * ngenes);
    }
    var mat1 = scran.initializeSparseMatrixFromDenseArray(ngenes, half, dense_buffer);
    var qc1 = scran.computePerCellQCMetrics(mat1.matrix, subs);
    var filt1 = scran.computePerCellQCFilters(qc1);

    for (var c = half; c < ncells; c++) {
        let out = mat.column(c);
        dense_buffer.array().set(out, (c - half) * ngenes);
    }
    var mat2 = scran.initializeSparseMatrixFromDenseArray(ngenes, half, dense_buffer);
    var qc2 = scran.computePerCellQCMetrics(mat2.matrix, subs);
    var filt2 = scran.computePerCellQCFilters(qc2);

    // Comparing values.
    expect(compare.equalArrays(filt.discardSums().slice(0, half), filt1.discardSums())).toBe(true);
    expect(compare.equalArrays(filt.discardDetected().slice(0, half), filt1.discardDetected())).toBe(true);
    expect(compare.equalArrays(filt.discardSubsetProportions(0).slice(0, half), filt1.discardSubsetProportions(0))).toBe(true);

    expect(compare.equalArrays(filt.discardSums().slice(half, ncells), filt2.discardSums())).toBe(true);
    expect(compare.equalArrays(filt.discardDetected().slice(half, ncells), filt2.discardDetected())).toBe(true);
    expect(compare.equalArrays(filt.discardSubsetProportions(0).slice(half, ncells), filt2.discardSubsetProportions(0))).toBe(true);

    expect(compare.equalArrays(filt.thresholdsSums()[0], filt1.thresholdsSums()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholdsDetected()[0], filt1.thresholdsDetected()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholdsSubsetProportions(0)[0], filt1.thresholdsSubsetProportions(0)[0])).toBe(true);

    expect(compare.equalArrays(filt.thresholdsSums()[1], filt2.thresholdsSums()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholdsDetected()[1], filt2.thresholdsDetected()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholdsSubsetProportions(0)[1], filt2.thresholdsSubsetProportions(0)[0])).toBe(true);

    // Cleaning up the mess.
    mat.free();
    block.free();
    qc.free();
    filt.free();

    dense_buffer.free(); 
    mat1.matrix.free();
    qc1.free();
    filt1.free();
    mat2.matrix.free();
    qc2.free();
    filt2.free();
});

test("per-cell QC filters can be mocked up", () => {
    var ngenes = 100;
    var nsubs = 2;
    var nblocks = 2;

    var qc = scran.emptyPerCellQCFiltersResults(ngenes, nsubs, nblocks);
    expect(qc.numberOfSubsets()).toBe(2);

    for (const y of [ "discardSums", "discardDetected" ]) {
        var x = qc[y]({copy: false});
        expect(x.length).toBe(ngenes);
        x[0] = 1;
        expect(qc[y]()[0]).toBe(1);
    }

    for (var s = 0; s < nsubs; s++) {
        var x = qc.discardSubsetProportions(s, {copy: false});
        expect(x.length).toBe(ngenes);
        x[10] = 1;
        expect(qc.discardSubsetProportions(s)[10]).toEqual(1);
    }

    {
        var x = qc.discardOverall({ copy: false });
        x[2] = 1;
        expect(qc.discardOverall()[2]).toEqual(1);
    }

    for (const y of [ "thresholdsSums", "thresholdsDetected" ]) {
        let x = qc[y]({ copy: false });
        expect(x.length).toEqual(nblocks);
        x[1] = 20;
        expect(qc[y]()[1]).toEqual(20);
    }
    
    for (var s = 0; s < nsubs; s++) {
        var x = qc.thresholdsSubsetProportions(s, {copy: false});
        expect(x.length).toBe(nblocks);
        x[0] = 0.9;
        expect(qc.thresholdsSubsetProportions(s)[0]).toEqual(0.9);
    }

    qc.free();
});
