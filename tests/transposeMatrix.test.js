import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as wa from "wasmarrays.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("transposeMatrix works correctly", () => {
    let nr = 200;
    let nc = 100;
    let arr = new Float64Array(nr * nc);
    arr.forEach((x, i) => {
        arr[i] = Math.random();
    });

    let manual = new Float64Array(arr.length);
    for (var r = 0; r < nr; r++) {
        for (var c = 0; c < nc; c++) {
            manual[r * nc + c] = arr[c * nr + r];
        }
    }

    let transposed = scran.transposeMatrix(nr, nc, arr)
    expect(transposed).toEqual(manual);
    expect(() => scran.transposeMatrix(nr + 10, nc, arr)).toThrow("should have length");

    let transposed2 = scran.transposeMatrix(nr, nc, arr, { asTypedArray: false });
    expect(transposed2 instanceof wa.Float64WasmArray).toBe(true);
    expect(transposed2.array()).toEqual(manual);

    let buffer = scran.createFloat64WasmArray(nr * nc);
    scran.transposeMatrix(nr, nc, arr, { buffer });
    expect(buffer.array()).toEqual(manual);
    expect(() => scran.transposeMatrix(nr + 10, nc, arr, { buffer })).toThrow("should have length");
    buffer.free();

    manual = new Float64Array(arr.length);
    for (var r = 0; r < nr; r++) {
        for (var c = 0; c < nc; c++) {
            manual[c * nr + r] = arr[r * nc + c];
        }
    }
    transposed = scran.transposeMatrix(nr, nc, arr, { columnMajor: false })
    expect(transposed).toEqual(manual);
})
