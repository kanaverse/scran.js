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
    var res = scran.modelGeneVar(norm);

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
    var res = scran.modelGeneVar(norm, { block: block });

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

test("Variance modelling results can be mocked up", () => {
    var ngenes = 100;

    // Without blocking, averages are the same as block 0.
    {
        var nblocks = 1;
        var res = scran.emptyModelGeneVarResults(ngenes, nblocks);

        expect(() => res.means()).toThrow("fillable");
        let x = res.means({ fillable: true });
        x[0] = 2000;

        expect(res.means()[0]).toBe(2000);
        expect(res.means({ block: 0 })[0]).toBe(2000);

        res.free();
    }

    // With multiple blocks, they are different.
    {
        var nblocks = 2;
        var res = scran.emptyModelGeneVarResults(ngenes, nblocks);
        let x = res.residuals({ fillable: true });
        x[0] = 2000;

        expect(() => res.residuals({ block: 0 })).toThrow("fillable");
        let y = res.residuals({ block: 0, fillable: true });
        y[0] = 1000;

        expect(res.residuals()[0]).toBe(2000);
        expect(res.residuals({ block: 0 })[0]).toBe(1000);

        res.free();
    }
})
