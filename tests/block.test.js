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

test("block filtering works", () => {
    let x = scran.createInt32WasmArray(6);
    x.set([0,1,2,0,1,2]);

    {
        let filtered = scran.filterBlock(x, [0, 1, 0, 1, 0, 1]);
        expect(Array.from(filtered.array())).toEqual([0,2,1]);
        filtered.free();

        expect(() => scran.filterBlock(x, [])).toThrow("should have the same length");
    }

    // Works with WasmArrays.
    {
        let filter = scran.createUint8WasmArray(6);
        filter.set([1, 0, 0, 0, 0, 1]);
        let filtered = scran.filterBlock(x, filter);
        expect(Array.from(filtered.array())).toEqual([1,2,0,1]);
        filtered.free();
    }

    // Works with TypedArrays.
    {
        let filter = new Uint8Array(6);
        filter.set([0, 0, 1, 1, 0, 0]);
        let filtered = scran.filterBlock(x, filter);
        expect(Array.from(filtered.array())).toEqual([0,1,1,2]);
        filtered.free();
    }

    // Works with a buffer.
    {
        let buffer = scran.createInt32WasmArray(2);
        let filter = new Uint8Array(6);
        filter.set([0, 1, 1, 1, 1, 0]);

        let filtered = scran.filterBlock(x, filter, { buffer: buffer });
        expect(Array.from(filtered.array())).toEqual([0,2]);
        buffer.free();

        expect(() => scran.filterBlock(x, [1,1,0,0,0,1], { buffer: buffer })).toThrow("length of 'buffer'");
    }

    x.free();
})

test("block subsetting works", () => {
    let x = scran.createInt32WasmArray(6);
    x.set([0,1,2,0,1,2]);

    {
        let filtered = scran.subsetBlock(x, [0, 2, 4]);
        expect(Array.from(filtered.array())).toEqual([0,2,1]);
        filtered.free();
    }

    {
        // Preserves order.
        let filtered = scran.subsetBlock(x, [5, 3, 1]);
        expect(Array.from(filtered.array())).toEqual([2,0,1]);
        filtered.free();
    }

    {
        // Works with a buffer.
        let buffer = scran.createInt32WasmArray(6);
        let filtered = scran.subsetBlock(x, [0,2,4,5,3,1], { buffer: buffer });
        expect(Array.from(buffer.array())).toEqual([0,2,1,2,0,1]);
        buffer.free();
    }

    {
        // Inverting the filter.
        let filtered = scran.subsetBlock(x, [0, 1, 0, 0, 0, 1], { filter: false });
        expect(Array.from(filtered.array())).toEqual([1, 2]);
        filtered.free();
    }
})

test("block releveling works", () => {
    let buffer = scran.createInt32WasmArray(6);
    buffer.set([2,1,4,1,2,4]);
    let mapping = scran.dropUnusedBlock(buffer);
    expect(Array.from(buffer.array())).toEqual([1,0,2,0,1,2]);
    expect(mapping).toEqual([1,2,4]);
})

