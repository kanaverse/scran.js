import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("Size factor calculation works as expected", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    var groups = new Uint32Array(ncells);
    groups.forEach((x, i) => groups[i] = i % 20);

    var norm = scran.groupedSizeFactors(mat, groups);
    expect(norm.length).toBe(ncells);

    // Basic check for validity.
    let positive = 0;
    norm.forEach(x => positive += (x > 0));
    expect(positive).toBe(ncells);

    // Still works with options.
    var norm2 = scran.groupedSizeFactors(mat, groups, { center: false, reference: 1 });
    positive = 0;
    norm2.forEach(x => positive += (x > 0));
    expect(positive).toBe(ncells);

    // Cleaning up.
    mat.free();
    norm.free();
    norm2.free();
});

test("Size factor calculation works with buffering", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells, 1);

    // Using a WasmArray for some variety.
    var groups = scran.createInt32WasmArray(ncells);
    let group_arr = groups.array();
    group_arr.forEach((x, i) => group_arr[i] = i % 20);

    var thing = scran.createFloat64WasmArray(ncells);
    scran.groupedSizeFactors(mat, groups, { buffer: thing });

    // Everything's still okay.
    expect(thing.length).toBe(ncells);
    let positive = 0;
    thing.forEach(x => positive += (x > 0));
    expect(positive).toBe(ncells);

    // Cleaning up.
    mat.free();
    thing.free();
    groups.free();
})
