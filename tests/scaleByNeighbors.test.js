import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("scaling by neighbors works with basic inputs", () => {
    var ncells = 100;

    var pc1 = simulate.simulatePCs(10, ncells);
    var pc2 = simulate.simulatePCs(20, ncells);
    let output = scran.scaleByNeighbors([pc1, pc2], ncells);
    expect(output.length).toBe(30 * ncells);

    let pc1_arr = pc1.array();
    let pc2_arr = pc2.array();
    let out_arr = output.array();

    // First array is used as the reference so should be identical..
    expect(pc1_arr[0]).toBe(out_arr[0]);
    expect(pc1_arr[9]).toBe(out_arr[9]);
    expect(pc1_arr[990]).toBe(out_arr[2970]);
    expect(pc1_arr[999]).toBe(out_arr[2979]);

    // Ratio should be consistent at both the start and end.
    let ratio_start = pc2_arr[0] / out_arr[10];
    expect(Math.abs(pc2_arr[19] / out_arr[29] - ratio_start)).toBeLessThan(0.00000001);
    expect(Math.abs(pc2_arr[1980] / out_arr[2980] - ratio_start)).toBeLessThan(0.00000001);
    expect(Math.abs(pc2_arr[1999] / out_arr[2999] - ratio_start)).toBeLessThan(0.00000001);

    pc1.free();
    pc2.free();
    output.free();
})

test("scaling by neighbors works with presupplied inputs", () => {
    var ncells = 100;

    var pc1 = simulate.simulatePCs(10, ncells);
    var pc2 = simulate.simulatePCs(20, ncells);
    let regular = scran.scaleByNeighbors([pc1, pc2], ncells);

    // Prebuilt indices.
    let index1 = scran.buildNeighborSearchIndex(pc1, { numberOfDims: 10, numberOfCells: ncells });
    let index2 = scran.buildNeighborSearchIndex(pc2, { numberOfDims: 20, numberOfCells: ncells });

    let output = scran.scaleByNeighbors([pc1, pc2], ncells, { indices: [index1, index2] });
    expect(compare.equalFloatArrays(output.array(), regular.array())).toBe(true);

    // Presupplied buffer.
    let buffer = scran.createFloat64WasmArray(30 * ncells);
    let stuff = scran.scaleByNeighbors([pc1, pc2], ncells, { buffer: buffer });
    expect(buffer.offset).toBe(stuff.offset);
    expect(compare.equalFloatArrays(buffer.array(), regular.array())).toBe(true);

    pc1.free();
    pc2.free();
    regular.free();
    index1.free();
    index2.free();
    output.free();
    buffer.free();
})

