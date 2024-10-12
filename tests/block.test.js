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
