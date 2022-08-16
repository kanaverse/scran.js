import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("per-cell QC ADT-based filters can be computed", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.computePerCellAdtQcMetrics(mat, subs);
    var filt = scran.computePerCellAdtQcFilters(qc);

    expect(filt.discardDetected().length).toBe(ncells);
    expect(filt.discardSubsetTotals(0).length).toBe(ncells);

    expect(filt.thresholdsDetected().length).toBe(1);
    expect(filt.thresholdsSubsetTotals(0).length).toBe(1);

    mat.free();
    qc.free();
    filt.free();
});

test("per-cell ADT-based QC filters can be computed with blocking", () => {
    var ngenes = 100;
    var ncells = 1000;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);
   
    var block = scran.createInt32WasmArray(ncells);
    var half = ncells / 2;
    block.fill(0, 0, half);
    block.fill(1, half, ncells);

    // Computing with blocks.
    var qc = scran.computePerCellAdtQcMetrics(mat, subs);
    var filt = scran.computePerCellAdtQcFilters(qc, { block: block });

    // Computing manually.
    var dense_buffer = scran.createFloat64WasmArray(ngenes * half);

    for (var c = 0; c < half; c++) {
        let out = mat.column(c);
        dense_buffer.array().set(out, c * ngenes);
    }
    var mat1 = scran.initializeSparseMatrixFromDenseArray(ngenes, half, dense_buffer);
    var qc1 = scran.computePerCellAdtQcMetrics(mat1.matrix, subs);
    var filt1 = scran.computePerCellAdtQcFilters(qc1);

    for (var c = half; c < ncells; c++) {
        let out = mat.column(c);
        dense_buffer.array().set(out, (c - half) * ngenes);
    }
    var mat2 = scran.initializeSparseMatrixFromDenseArray(ngenes, half, dense_buffer);
    var qc2 = scran.computePerCellAdtQcMetrics(mat2.matrix, subs);
    var filt2 = scran.computePerCellAdtQcFilters(qc2);

    // Comparing values.
    expect(compare.equalArrays(filt.discardDetected().slice(0, half), filt1.discardDetected())).toBe(true);
    expect(compare.equalArrays(filt.discardSubsetTotals(0).slice(0, half), filt1.discardSubsetTotals(0))).toBe(true);

    expect(compare.equalArrays(filt.discardDetected().slice(half, ncells), filt2.discardDetected())).toBe(true);
    expect(compare.equalArrays(filt.discardSubsetTotals(0).slice(half, ncells), filt2.discardSubsetTotals(0))).toBe(true);

    expect(compare.equalArrays(filt.thresholdsDetected()[0], filt1.thresholdsDetected()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholdsSubsetTotals(0)[0], filt1.thresholdsSubsetTotals(0)[0])).toBe(true);

    expect(compare.equalArrays(filt.thresholdsDetected()[1], filt2.thresholdsDetected()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholdsSubsetTotals(0)[1], filt2.thresholdsSubsetTotals(0)[0])).toBe(true);

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
