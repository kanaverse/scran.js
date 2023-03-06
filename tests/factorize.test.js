import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("factorization works as expected", () => {
    {
        let out = scran.factorize(["A", "A", "B", "B", "B"]);
        expect(Array.from(out.ids.array())).toEqual([0,0,1,1,1]);
        expect(out.levels).toEqual(["A", "B"]);
        out.ids.free();
    }

    // Respects the input order.
    {
        let out = scran.factorize(["B", "B", "B", "A", "A"]);
        expect(Array.from(out.ids.array())).toEqual([0,0,0,1,1]);
        expect(out.levels).toEqual(["B", "A"]);
        out.ids.free();
    }

    // Multiple levels.
    {
        let out = scran.factorize(["C", "A", "B", "A", "C"]);
        expect(Array.from(out.ids.array())).toEqual([0,1,2,1,0]);
        expect(out.levels).toEqual(["C", "A", "B"]);
        out.ids.free();
    }

    // Handles invalid values.
    {
        expect(() => scran.factorize(["C", "A", null])).toThrow("detected invalid value");
        expect(() => scran.factorize([Number.NaN, 1, 2, 3])).toThrow("detected invalid value");

        let out = scran.factorize([Number.NaN, 1, "V", 3], { action: "none" });
        expect(Array.from(out.ids.array())).toEqual([-1, 0, 1, 2]);
        expect(out.levels).toEqual([1,"V",3]);
        out.ids.free();
    }

    // Works with TypedArrays.
    {
        let thing = new Float32Array([2,1,0,1,2]);
        let out = scran.factorize(thing);
        expect(Array.from(out.ids.array())).toEqual([0,1,2,1,0]);
        expect(out.levels).toEqual([2,1,0]);
        out.ids.free();

        let out2 = scran.factorize(thing, { asWasmArray: false });
        expect(out2.ids).toEqual(new Int32Array([0,1,2,1,0]));
        expect(out2.levels).toEqual([2,1,0]);
    }

    // Works with a buffer.
    {
        let buffer = scran.createInt32WasmArray(5);
        scran.convertBlock(["B", "B", "C", "A", "A"], { buffer: buffer });
        expect(Array.from(buffer.array())).toEqual([0,0,1,2,2]);
        buffer.free();

        buffer = new Int32Array(4);
        expect(() => scran.convertBlock([2,1], { buffer: buffer })).toThrow("length");
        scran.convertBlock([3,3,2,1], { buffer: buffer });
        expect(buffer).toEqual(new Int32Array([0,0,1,2]));
    }
})
