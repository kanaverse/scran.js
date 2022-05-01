import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("Size factor calculation works as expected", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    var norm = scran.medianSizeFactors(mat);
    expect(norm.length).toBe(ncells);

    // Basic check for validity.
    let positive = 0;
    norm.forEach(x => positive += (x > 0));
    expect(positive).toBe(ncells);

    // Cleaning up.
    mat.free();
    norm.free();
});

test("Size factor calculation works with a reference", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    // Making an artificial reference from the first column.
    let ref = mat.column(0);
    ref.forEach((x, i) => ref[i] = 100 * x);

    var norm = scran.medianSizeFactors(mat, { center: false, reference: ref });
    expect(norm.length).toBe(ncells);

    // dividing by the size factor scales the first column up by 100 to match the reference.
    expect(Math.abs(norm.array()[0] - 0.01)).toBeLessThan(0.000000001); 

    // Everything's still okay.
    let positive = 0;
    norm.forEach(x => positive += (x > 0));
    expect(positive).toBe(ncells);

    // Cleaning up.
    mat.free();
    norm.free();
});

test("Size factor calculation works with blocking", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    var thing = scran.createFloat64WasmArray(ncells);
    scran.medianSizeFactors(mat, { buffer: thing });

    expect(thing.length).toBe(ncells);

    // Everything's still okay.
    let positive = 0;
    thing.forEach(x => positive += (x > 0));
    expect(positive).toBe(ncells);

    // Cleaning up.
    mat.free();
    thing.free();
})
