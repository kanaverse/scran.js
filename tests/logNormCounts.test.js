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

    // Checking values.
    var sf = new Array(ncells);
    for (var i = 0; i < ncells; i++) {
        let current = mat.column(i);
        sf[i] = current.reduce((x, y) => x + y);
    }
    let mean_sf = sf.reduce((x, y) => x + y) / ncells;
    var expected = mat.column(0).map(x => Math.log2(x / (sf[0] / mean_sf) + 1));
    expect(compare.equalFloatArrays(expected, norm.column(0))).toBe(true);

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
    var expected = mat.column(0).map(x => Math.log2(x / sf[0] + 1));
    expect(compare.equalFloatArrays(expected, norm.column(0))).toBe(true);

    // Cleaning up.
    mat.free();
    norm.free();
});

test("Centering works as expected with blocking", () => {
    var ncells = 100;
    var sf = new Array(ncells);
    for (var i = 0; i < ncells ; i++) {
        sf[i] = Math.random();
    }

    var centered = scran.centerSizeFactors(sf, { block: block });
    const mean = centered.reduce((x, y) => x + y) / ncells;
    expect(Math.abs(mean - 1)).toBeLessThan(1e-8);

    var half = 11; 
    var block = new Array(ncells);
    block.fill(0, 0, half);
    block.fill(1, half, ncells);
    centered = scran.centerSizeFactors(sf, { block: block });

    const first_half = centered.slice(0, half).reduce((x, y) => x + y) / half;
    const second_half = centered.slice(half, ncells).reduce((x, y) => x + y) / (ncells - half);

    // Only one of these is true under the default LOWEST scaling scheme.
    if (first_half > second_half) {
        expect(Math.abs(second_half - 1)).toBeLessThan(1e-8);
    } else {
        expect(Math.abs(first_half - 1)).toBeLessThan(1e-8);
    }
})

test("Log-normalization behaves with zeros", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var empty = new Float64Array(ncells);
    empty.fill(0);
    expect(() => scran.logNormCounts(mat, { sizeFactors: empty })).toThrow("zero");

    // Now trying with allowed zeros.
    let out = scran.logNormCounts(mat, { sizeFactors: empty, allowZeros: true });
    let ocol = out.column(0);
    let rcol = mat.column(0);
    for (var i = 0; i < ngenes; i++) {
        expect(ocol[i]).toBeCloseTo(Math.log2(rcol[i] + 1), 6);
    }

    mat.free();
})
