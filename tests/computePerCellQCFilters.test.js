import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as scran from "../js/index.js";

test("per-cell QC filters can be computed", () => {
    var ngenes = 100;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);

    var qc = scran.computePerCellQCMetrics(mat, subs);
    var filt = scran.computePerCellQCFilters(qc);

    expect(filt.discard_sums().length).toBe(ncells);
    expect(filt.discard_detected().length).toBe(ncells);
    expect(filt.discard_subset_proportions(0).length).toBe(ncells);

    expect(filt.thresholds_sums().length).toBe(1);
    expect(filt.thresholds_detected().length).toBe(1);
    expect(filt.thresholds_subset_proportions(0).length).toBe(1);

    mat.free();
    qc.free();
    filt.free();
});

test("per-cell QC filters can be computed with blocking", () => {
    var ngenes = 100;
    var ncells = 1000;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var subs = simulate.simulateSubsets(ngenes, 1);
   
    var block = new scran.Int32WasmArray(ncells);
    var half = ncells / 2;
    block.fill(0, 0, half);
    block.fill(1, half, ncells);

    // Computing with blocks.
    var qc = scran.computePerCellQCMetrics(mat, subs);
    var filt = scran.computePerCellQCFilters(qc, 3, block);

    // Computing manually.
    var dense_buffer = new scran.Float64WasmArray(ngenes * half);

    for (var c = 0; c < half; c++) {
        let out = mat.column(c);
        dense_buffer.array().set(out, c * ngenes);
    }
    var mat1 = scran.initializeSparseMatrixFromDenseArray(ngenes, half, dense_buffer);
    var qc1 = scran.computePerCellQCMetrics(mat1, subs);
    var filt1 = scran.computePerCellQCFilters(qc1);

    for (var c = half; c < ncells; c++) {
        let out = mat.column(c);
        dense_buffer.array().set(out, (c - half) * ngenes);
    }
    var mat2 = scran.initializeSparseMatrixFromDenseArray(ngenes, half, dense_buffer);
    var qc2 = scran.computePerCellQCMetrics(mat2, subs);
    var filt2 = scran.computePerCellQCFilters(qc2);

    // Comparing values.
    expect(compare.equalArrays(filt.discard_sums().slice(0, half), filt1.discard_sums())).toBe(true);
    expect(compare.equalArrays(filt.discard_detected().slice(0, half), filt1.discard_detected())).toBe(true);
    expect(compare.equalArrays(filt.discard_subset_proportions(0).slice(0, half), filt1.discard_subset_proportions(0))).toBe(true);

    expect(compare.equalArrays(filt.discard_sums().slice(half, ncells), filt2.discard_sums())).toBe(true);
    expect(compare.equalArrays(filt.discard_detected().slice(half, ncells), filt2.discard_detected())).toBe(true);
    expect(compare.equalArrays(filt.discard_subset_proportions(0).slice(half, ncells), filt2.discard_subset_proportions(0))).toBe(true);

    expect(compare.equalArrays(filt.thresholds_sums()[0], filt1.thresholds_sums()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholds_detected()[0], filt1.thresholds_detected()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholds_subset_proportions(0)[0], filt1.thresholds_subset_proportions(0)[0])).toBe(true);

    expect(compare.equalArrays(filt.thresholds_sums()[1], filt2.thresholds_sums()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholds_detected()[1], filt2.thresholds_detected()[0])).toBe(true);
    expect(compare.equalArrays(filt.thresholds_subset_proportions(0)[1], filt2.thresholds_subset_proportions(0)[0])).toBe(true);

    // Cleaning up the mess.
    mat.free();
    block.free();
    qc.free();
    filt.free();

    dense_buffer.free(); 
    mat1.free();
    qc1.free();
    filt1.free();
    mat2.free();
    qc2.free();
    filt2.free();
});
