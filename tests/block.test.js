import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("block creation works", () => {
    {
        let out = scran.createBlock([4,3]);
        expect(Array.from(out.array())).toEqual([0,0,0,0,1,1,1]);
        out.free();
    }

    // Works with empty stuff.
    {
        let out = scran.createBlock([0,1,2,3]);
        expect(Array.from(out.array())).toEqual([1,2,2,3,3,3]);
        out.free();
    }

    // Works with a buffer.
    {
        let buffer = scran.createInt32WasmArray(5)
        scran.createBlock([2,3], { buffer: buffer });
        expect(Array.from(buffer.array())).toEqual([0,0,1,1,1]);
        buffer.free();

        expect(() => scran.createBlock([2,1], { buffer: buffer })).toThrow("length");
    }
})

test("block conversion works", () => {
    {
        let out = scran.convertBlock(["A", "A", "B", "B", "B"]);
        expect(Array.from(out.ids.array())).toEqual([0,0,1,1,1]);
        expect(out.levels).toEqual(["A", "B"]);
        out.ids.free();
    }

    // Respects the input order.
    {
        let out = scran.convertBlock(["B", "B", "B", "A", "A"]);
        expect(Array.from(out.ids.array())).toEqual([0,0,0,1,1]);
        expect(out.levels).toEqual(["B", "A"]);
        out.ids.free();
    }

    // Works with TypedArrays.
    {
        let thing = new Int32Array(5);
        thing.set([2,1,0,1,2]);
        let out = scran.convertBlock(thing);
        expect(Array.from(out.ids.array())).toEqual([0,1,2,1,0]);
        expect(out.levels).toEqual([2,1,0]);
        out.ids.free();
    }

    // Works with a buffer.
    {
        let buffer = scran.createInt32WasmArray(5);
        scran.convertBlock(["B", "B", "C", "A", "A"], { buffer: buffer });
        expect(Array.from(buffer.array())).toEqual([0,0,1,2,2]);
        buffer.free();

        expect(() => scran.convertBlock([2,1], { buffer: buffer })).toThrow("length");
    }
})

test("block releveling works", () => {
    let buffer = scran.createInt32WasmArray(6);
    buffer.set([2,1,4,1,2,4]);
    let mapping = scran.removeUnusedBlock(buffer);
    expect(Array.from(buffer.array())).toEqual([1,0,2,0,1,2]);
    expect(mapping).toEqual([1,2,4]);
})

