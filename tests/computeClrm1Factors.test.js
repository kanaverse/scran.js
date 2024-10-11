import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("Size factor calculation works as expected", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    var norm = scran.computeClrm1Factors(mat);
    expect(norm.length).toBe(ncells);

    // Basic check for validity.
    let positive = 0;
    norm.forEach(x => positive += (x > 0));
    expect(positive).toBe(ncells);

    // Cleaning up.
    mat.free();
});

test("Size factor calculation works with buffering", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    var thing = scran.createFloat64WasmArray(ncells);
    scran.computeClrm1Factors(mat, { buffer: thing });

    expect(thing.length).toBe(ncells);

    // Everything's still okay.
    let positive = 0;
    thing.forEach(x => positive += (x > 0));
    expect(positive).toBe(ncells);

    // Cleaning up.
    mat.free();
    thing.free();
})
