import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("Quick ADT size factor calculation works as expected", () => {
    var ngenes = 100;
    var ncells = 200;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    var buffer = scran.quickAdtSizeFactors(mat);
    expect(buffer.length).toBe(ncells);

    // Everything should be positive.
    var ok = 0;
    buffer.forEach(x => { ok += (x > 0); });
    expect(ok).toBe(ncells);

    mat.free();
    buffer.free();
})

test("Quick ADT size factor calculation works with blocking", () => {
    var ngenes = 100;
    var ncells = 200;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    // Mocking up a blocking factor.
    var block = new Int32Array(ncells);
    var nblocks = 4;
    for (var i = 0; i < ncells; i++) {
        block[i] = Math.floor(Math.random() * nblocks);
    }
    for (var j = 0; j < nblocks; j++) {
        block[j] = j;
    }

    var buffer = scran.quickAdtSizeFactors(mat, { block: block });
    expect(buffer.length).toBe(ncells);

    // Everything should be positive.
    var ok = 0;
    buffer.forEach(x => { ok += (x > 0); });
    expect(ok).toBe(ncells);

    mat.free();
    buffer.free();
})

test("Quick ADT size factors are computed correctly for input buffers", () => {
    var ngenes = 100;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    var buffer = scran.quickAdtSizeFactors(mat);
    let buffer2 = scran.createFloat64WasmArray(ncells);
    scran.quickAdtSizeFactors(mat, { buffer: buffer2 } );
    expect(compare.equalArrays(buffer.array(), buffer2.array())).toBe(true);

    mat.free();
    buffer.free();
    buffer2.free();
})
