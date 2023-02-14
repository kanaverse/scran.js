import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("Log-normalization works as expected", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var norm = scran.logNormCounts(mat);
    expect(norm.constructor.name).toBe(mat.constructor.name);
    expect(norm.numberOfRows()).toBe(mat.numberOfRows());
    expect(norm.numberOfColumns()).toBe(mat.numberOfColumns());

    // Check that values are different.
    let rcol = mat.column(0);
    let ocol = norm.column(0);
    expect(ocol).not.toEqual(rcol);

    // Cleaning up.
    mat.free();
    norm.free();
});

test("Log-normalization works as expected with pre-supplied size factors", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var sf = new Array(ncells);
    for (var i = 0; i < ncells ; i++) {
        sf[i] = Math.random();
    }

    var norm = scran.logNormCounts(mat, { sizeFactors: sf });
    expect(norm.constructor.name).toBe(mat.constructor.name);
    expect(norm.numberOfRows()).toBe(mat.numberOfRows());
    expect(norm.numberOfColumns()).toBe(mat.numberOfColumns());
    
    // Checking values.
    var mean_sf = 0;
    sf.forEach(x => { mean_sf += x; });
    mean_sf /= ncells;

    var expected = mat.column(0).map(x => Math.log2(x / sf[0] * mean_sf + 1));
    expect(compare.equalFloatArrays(expected, norm.column(0))).toBe(true);

    // Cleaning up.
    mat.free();
    norm.free();
});

test("Log-normalization works as expected with blocking", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    // Using a prime number so that it's more likely that we get different mean
    // size factors between blocks; otherwise, the blocking wouldn't have any
    // effect if the means were the same.
    var half = 43; 

    var block = new Array(ncells);
    block.fill(0, 0, half);
    block.fill(1, half, ncells);
    var normed_full = scran.logNormCounts(mat, { block: block });

    var discard1 = new Array(ncells);
    discard1.fill(0, 0, half);
    discard1.fill(1, half, ncells);
    var sub1 = scran.filterCells(mat, discard1);
    var normed_sub1 = scran.logNormCounts(sub1);

    var discard2 = new Array(ncells);
    discard2.fill(1, 0, half);
    discard2.fill(0, half, ncells);
    var sub2 = scran.filterCells(mat, discard2);
    var normed_sub2 = scran.logNormCounts(sub2);

    // Only one of these is true under the default LOWEST scaling scheme.
    expect(
        compare.equalFloatArrays(normed_sub1.column(0), normed_full.column(0)) !=
        compare.equalFloatArrays(normed_sub2.column(0), normed_full.column(half))).toBe(true);

    mat.free();
    normed_full.free();
    sub1.free();
    normed_sub1.free();
    sub2.free();
    normed_sub2.free();
})

test("Log-normalization behaves with zeros", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var empty = new Float64Array(ncells);
    empty.fill(0);
    expect(() => scran.logNormCounts(mat, { sizeFactors: empty })).toThrow("positive");

    // Now trying with allowed zeros.
    let out = scran.logNormCounts(mat, { sizeFactors: empty, allowZeros: true });
    let ocol = out.column(0);
    let rcol = mat.column(0);
    for (var i = 0; i < ngenes; i++) {
        expect(ocol[i]).toBeCloseTo(Math.log2(rcol[i] + 1), 6);
    }

    mat.free();
})

test("centering of size factors gives the same results", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    let qc = scran.perCellRnaQcMetrics(mat);

    let rounder = x => Math.round(x * 1000000); // Check for equality to 6 decimal points of precision.

    // Unblocked.
    {
        var norm = scran.logNormCounts(mat);
        let sf = scran.centerSizeFactors(qc.sums());

        for (var c = 0; c < ncells; c++) {
            let rawcol = mat.column(c);
            let cursf = sf.array()[c];
            let expected = rawcol.map(x => Math.log2(x / cursf + 1));
            expect(norm.column(c).map(rounder)).toEqual(expected.map(rounder));
        }

        norm.free();
        sf.free();
    }

    // Blocked.
    {
        var block = new Array(ncells);
        let half = ncells * 0.3;
        block.fill(0, 0, half);
        block.fill(1, half, ncells);

        var norm = scran.logNormCounts(mat, { block });
        let sf = scran.createFloat64WasmArray(ncells);
        scran.centerSizeFactors(qc.sums(), { block: block, buffer: sf });

        for (var c = 0; c < ncells; c++) {
            let rawcol = mat.column(c);
            let cursf = sf.array()[c];
            let expected = rawcol.map(x => Math.log2(x / cursf + 1));
            expect(norm.column(c).map(rounder)).toEqual(expected.map(rounder));
        }

        norm.free();
        sf.free();
    }

    mat.free();
})
