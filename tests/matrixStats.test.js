import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as wa from "wasmarrays.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("rowSums works correctly", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);
    let rs = scran.rowSums(mat);
    expect(rs.length).toEqual(20);
    expect(rs[0]).toBeCloseTo(mat.row(0).reduce((a, b) => a + b));
    expect(rs[19]).toBeCloseTo(mat.row(19).reduce((a, b) => a + b));

    // Trying out the options.
    let buffer = scran.createFloat64WasmArray(20);
    rs = scran.rowSums(mat, { buffer: buffer });
    expect(rs[1]).toBeCloseTo(mat.row(1).reduce((a, b) => a + b));
    expect(rs[18]).toBeCloseTo(mat.row(18).reduce((a, b) => a + b));
    expect(rs[1]).toEqual(buffer.array()[1]);
    expect(rs[18]).toEqual(buffer.array()[18]);
    scran.free(buffer);

    let buffer2 = scran.createFloat64WasmArray(19);
    expect(() => scran.rowSums(mat, { buffer: buffer2 })).toThrow("length equal");
    scran.free(buffer2);

    rs = scran.rowSums(mat, { asTypedArray: false, numberOfThreads: 2 });
    expect(rs instanceof wa.Float64WasmArray).toBe(true);
    expect(rs.length).toEqual(20);
    scran.free(rs);
})

test("columnSums works correctly", () => {
    var mat = simulate.simulateDenseMatrix(20, 10);
    let cs = scran.columnSums(mat);
    expect(cs.length).toEqual(10);
    expect(cs[0]).toBeCloseTo(mat.column(0).reduce((a, b) => a + b));
    expect(cs[9]).toBeCloseTo(mat.column(9).reduce((a, b) => a + b));

    // Options are the same as the row sums, so we won't bother testing them again.
})
