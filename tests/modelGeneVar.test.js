import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize() });
afterAll(async () => { await scran.terminate() });

test("Variance modelling works as expected", () => {
    var ngenes = 1000;
    var ncells = 100;

    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);
    var res = scran.modelGeneVar(norm);

    // Some cursory tests.
    expect(res.means()[0] > 0).toBe(true);
    expect(res.variances()[0] > 0).toBe(true);
    expect(res.fitted()[0] > 0).toBe(true);
    expect(res.residuals().length).toBe(ngenes);

    // Cleaning up.
    mat.free();
    norm.free();
    res.free();
});

test("Variance modelling works as expected with blocking", () => {
    var ngenes = 1000;
    var ncells = 100;

    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    var block = new Array(ncells);
    var half = ncells / 2;
    block.fill(0, 0, half);
    block.fill(1, half, ncells);
    var res = scran.modelGeneVar(norm, block);

    var discard1 = new Array(ncells);
    discard1.fill(0, 0, half);
    discard1.fill(1, half, ncells);
    var sub1 = scran.filterCells(norm, discard1);
    var res1 = scran.modelGeneVar(sub1);

    var discard2 = new Array(ncells);
    discard2.fill(1, 0, half);
    discard2.fill(0, half, ncells);
    var sub2 = scran.filterCells(norm, discard2);
    var res2 = scran.modelGeneVar(sub2);

    // Comparing results.
    expect(compare.equalFloatArrays(res.means(0), res1.means())).toBe(true);
    expect(compare.equalFloatArrays(res.variances(0), res1.variances())).toBe(true);
    expect(compare.equalFloatArrays(res.fitted(0), res1.fitted())).toBe(true);
    expect(compare.equalFloatArrays(res.residuals(0), res1.residuals())).toBe(true);

    expect(compare.equalFloatArrays(res.means(1), res2.means())).toBe(true);
    expect(compare.equalFloatArrays(res.variances(1), res2.variances())).toBe(true);
    expect(compare.equalFloatArrays(res.fitted(1), res2.fitted())).toBe(true);
    expect(compare.equalFloatArrays(res.residuals(1), res2.residuals())).toBe(true);


    // Cleaning up.
    mat.free();
    norm.free();
    res.free();
});


