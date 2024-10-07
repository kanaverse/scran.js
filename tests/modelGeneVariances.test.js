import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("Variance modelling works as expected", () => {
    var ngenes = 1000;
    var ncells = 100;

    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);
    var res = scran.modelGeneVariances(norm);

    // Some cursory tests.
    expect(res.numberOfBlocks()).toBe(1);

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
    var res = scran.modelGeneVariances(norm, { block: block });

    var keep1 = new Array(ncells);
    keep1.fill(1, 0, half);
    keep1.fill(0, half, ncells);
    var sub1 = scran.filterCells(norm, keep1);
    var res1 = scran.modelGeneVariances(sub1);

    var keep2 = new Array(ncells);
    keep2.fill(0, 0, half);
    keep2.fill(1, half, ncells);
    var sub2 = scran.filterCells(norm, keep2);
    var res2 = scran.modelGeneVariances(sub2);

    // Comparing results.
    expect(compare.equalFloatArrays(res.means({ block: 0 }), res1.means())).toBe(true);
    expect(compare.equalFloatArrays(res.variances({ block: 0 }), res1.variances())).toBe(true);
    expect(compare.equalFloatArrays(res.fitted({ block: 0 }), res1.fitted())).toBe(true);
    expect(compare.equalFloatArrays(res.residuals({ block: 0 }), res1.residuals())).toBe(true);

    expect(compare.equalFloatArrays(res.means({ block: 1 }), res2.means())).toBe(true);
    expect(compare.equalFloatArrays(res.variances({ block: 1 }), res2.variances())).toBe(true);
    expect(compare.equalFloatArrays(res.fitted({ block: 1 }), res2.fitted())).toBe(true);
    expect(compare.equalFloatArrays(res.residuals({ block: 1 }), res2.residuals())).toBe(true);

    // Checking that the average works as expected.
    let averager = (x, y) => x.map((x, i) => (x + y[i])/2);

    expect(compare.equalFloatArrays(res.means(), averager(res1.means(), res2.means()))).toBe(true);
    expect(compare.equalFloatArrays(res.variances(), averager(res1.variances(), res2.variances()))).toBe(true);
    expect(compare.equalFloatArrays(res.fitted(), averager(res1.fitted(), res2.fitted()))).toBe(true);
    expect(compare.equalFloatArrays(res.residuals(), averager(res1.residuals(), res2.residuals()))).toBe(true);

    // Cleaning up.
    mat.free();
    norm.free();
    res.free();
});
