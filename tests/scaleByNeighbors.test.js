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

    // First array is used as the reference so should be identical..
    expect(pc1_arr[0]).toBe(output[0]);
    expect(pc1_arr[9]).toBe(output[9]);
    expect(pc1_arr[990]).toBe(output[2970]);
    expect(pc1_arr[999]).toBe(output[2979]);

    // Ratio should be consistent at both the start and end.
    let ratio_start = pc2_arr[0] / output[10];
    expect(Math.abs(pc2_arr[19] / output[29] - ratio_start)).toBeLessThan(0.00000001);
    expect(Math.abs(pc2_arr[1980] / output[2980] - ratio_start)).toBeLessThan(0.00000001);
    expect(Math.abs(pc2_arr[1999] / output[2999] - ratio_start)).toBeLessThan(0.00000001);

    pc1.free();
    pc2.free();
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
    expect(compare.equalFloatArrays(output, regular)).toBe(true);

    // Presupplied buffer.
    let buffer = scran.createFloat64WasmArray(30 * ncells);
    let stuff = scran.scaleByNeighbors([pc1, pc2], ncells, { asTypedArray: false, buffer: buffer });
    expect(buffer.offset).toBe(stuff.offset);
    expect(compare.equalFloatArrays(buffer.array(), regular)).toBe(true);

    pc1.free();
    pc2.free();
    index1.free();
    index2.free();
    buffer.free();
})

test("scaling by neighbors works with weights", () => {
    var ncells = 100;
    var pcs = simulate.simulatePCs(10, ncells);
    let output = scran.scaleByNeighbors([pcs, pcs, pcs], ncells, { weights: [2, 3, 1] });
    let pc_arr = pcs.array();

    expect(Math.abs(output[0] - 2 *pc_arr[0])).toBeLessThan(0.00000001);
    expect(Math.abs(output[10] - 3 * pc_arr[0])).toBeLessThan(0.00000001);
    expect(Math.abs(output[29] - pc_arr[9])).toBeLessThan(0.00000001);

    expect(Math.abs(output[2970] - 2 * pc_arr[990])).toBeLessThan(0.00000001);
    expect(Math.abs(output[2985] - 3 * pc_arr[995])).toBeLessThan(0.00000001);
    expect(Math.abs(output[2999] - pc_arr[999])).toBeLessThan(0.00000001);

    pcs.free();
})
