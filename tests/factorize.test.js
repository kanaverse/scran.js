import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("factorization works as expected", () => {
    {
        let out = scran.convertToFactor(["A", "A", "B", "B", "B"]);
        expect(Array.from(out.ids.array())).toEqual([0,0,1,1,1]);
        expect(out.levels).toEqual(["A", "B"]);
        out.ids.free();
    }

    // Multiple levels.
    {
        let out = scran.convertToFactor(["A", "B", "C", "A", "C"]);
        expect(Array.from(out.ids.array())).toEqual([0,1,2,0,2]);
        expect(out.levels).toEqual(["A", "B", "C"]);
        out.ids.free();
    }

    // Resorts on the input order for strings and ints.
    {
        let out = scran.convertToFactor(["B", "B", "B", "A", "A"]);
        expect(Array.from(out.ids.array())).toEqual([1,1,1,0,0]);
        expect(out.levels).toEqual(["A", "B"]);
        out.ids.free();

        let out2 = scran.convertToFactor([3,2,1,2,3]);
        expect(Array.from(out2.ids.array())).toEqual([2,1,0,1,2]);
        expect(out2.levels).toEqual([1,2,3]);
        out.ids.free();
    }

    // Handles invalid values.
    {
        expect(() => scran.convertToFactor(["C", "A", null])).toThrow("detected invalid value");
        expect(() => scran.convertToFactor([Number.NaN, 1, 2, 3])).toThrow("detected invalid value");

        let out = scran.convertToFactor([Number.NaN, 1, "V", 3], { action: "none" });
        expect(Array.from(out.ids.array())).toEqual([-1, 0, 1, 2]);
        expect(out.levels).toEqual([1,"V",3]);
        out.ids.free();
    }

    // Works with TypedArrays.
    {
        let thing = new Float32Array([2,1,0,1,2]);
        let out = scran.convertToFactor(thing);
        expect(Array.from(out.ids.array())).toEqual([2,1,0,1,2]);
        expect(out.levels).toEqual([0,1,2]);
        out.ids.free();

        let out2 = scran.convertToFactor(thing, { asWasmArray: false });
        expect(Array.from(out2.ids)).toEqual([2,1,0,1,2]);
        expect(out2.levels).toEqual([0,1,2]);
    }

    // Works with a buffer.
    {
        let buffer = scran.createInt32WasmArray(5);
        let out = scran.convertToFactor(["B", "B", "C", "A", "A"], { buffer: buffer });
        expect(Array.from(buffer.array())).toEqual([1,1,2,0,0]);
        expect(out.levels).toEqual(["A", "B", "C"]);
        buffer.free();

        buffer = new Int32Array(4);
        expect(() => scran.convertToFactor([2,1], { buffer: buffer })).toThrow("length");
        out = scran.convertToFactor([3,3,2,1], { buffer: buffer });
        expect(buffer).toEqual(new Int32Array([2,2,1,0]));
        expect(out.levels).toEqual([1,2,3]);
    }

    // Works with existing levels.
    {
        let out = scran.convertToFactor(["B", "B", "C", "A", "A"], { levels: [ "C", "B", "A" ] });
        expect(Array.from(out.ids.array())).toEqual([1,1,0,2,2]);
        out.ids.free();

        expect(() => scran.convertToFactor(["D", "B", "B", "C", "A", "A"], { levels: [ "C", "B", "A" ] })).toThrow("invalid");
        let out2 = scran.convertToFactor(["D", "B", "B", "C", "A", "A"], { levels: [ "C", "B", "A" ], action: "none" });
        expect(Array.from(out2.ids.array())).toEqual([-1,1,1,0,2,2]);
        out2.ids.free();
    }
})

test("dropUnusedLevels works as expected", () => {
    let buffer = scran.createInt32WasmArray(6);
    buffer.set([2,1,4,1,2,4]);
    let mapping = scran.dropUnusedLevels(buffer);
    expect(Array.from(buffer.array())).toEqual([1,0,2,0,1,2]);
    expect(mapping).toEqual([1,2,4]);

    // Also works for arrays.
    let arr = [3,5,2,9,3];
    mapping = scran.dropUnusedLevels(arr);
    expect(arr).toEqual([1,2,0,3,1]);
    expect(mapping).toEqual([2,3,5,9]);
})

test("resetLevels works as expected", () => {
    {
        let out = scran.convertToFactor(["C", "A", "B", "A", "B", "C"], { asWasmArray: false });
        scran.resetLevels(out, ["D", "C", "A", "B"]);
        expect(Array.from(out.ids)).toEqual([1,2,3,2,3,1]);
        expect(out.levels).toEqual(["D", "C", "A", "B"]);
    }

    {
        let out = scran.convertToFactor(["C", "A", "B", "A", "B", "C"], { asWasmArray: false });
        expect(() => scran.resetLevels(out, ["D"])).toThrow("detected level");
        scran.resetLevels(out, ["D", "B"], { action: "none" });
        expect(Array.from(out.ids)).toEqual([-1, -1, 1, -1, 1, -1]);
        expect(out.levels).toEqual(["D", "B"]);
    }
})

test("subsetFactor works as expected for WasmArray inputs", () => {
    let x = {
        ids: scran.createInt32WasmArray(6),
        levels: [ "A", "B", "C" ]
    };
    x.ids.set([0,1,2,0,1,2]);

    {
        let filtered = scran.subsetFactor(x, [0, 1, 0, 1, 0, 1], { filter: true });
        expect(Array.from(filtered.ids.array())).toEqual([0,2,1]);
        expect(filtered.levels).toEqual(x.levels);
        filtered.ids.free();
    }

    // Works with WasmArrays in the subset.
    {
        let filter = scran.createUint8WasmArray(6);
        filter.set([1, 0, 0, 0, 0, 1]);

        let filtered = scran.subsetFactor(x, filter, { filter: true });
        expect(Array.from(filtered.ids.array())).toEqual([1,2,0,1]);
        expect(filtered.levels).toEqual(x.levels);
        filtered.ids.free();
    }

    // Works with a WasmArray buffer.
    {
        let buffer = scran.createInt32WasmArray(2);
        let filter = new Uint8Array(6);
        filter.set([0, 1, 1, 1, 1, 0]);

        let filtered = scran.subsetFactor(x, filter, { filter: true, buffer: buffer });
        expect(Array.from(filtered.ids.array())).toEqual([0, 1]);
        expect(filtered.levels).toEqual(["A", "C"]); // auto-drop levels.
        filtered.ids.free();
    }

    // Works with TypedArray filters.
    {
        let filter = new Uint8Array(6);
        filter.set([0, 0, 1, 1, 0, 0]);

        let filtered = scran.subsetFactor(x, filter, { filter: true });
        expect(Array.from(filtered.ids.array())).toEqual([0,1,1,2]);
        expect(filtered.levels).toEqual(x.levels);
        filtered.ids.free();
    }

    x.ids.free();
})

test("subsetFactor works as expected for TypedArray inputs", () => {
    let x = {
        ids: new Int32Array([0,1,2,0,1,2]),
        levels: [ "x", "y", "z" ]
    };

    {
        let filtered = scran.subsetFactor(x, [0, 2, 4]);
        expect(Array.from(filtered.ids)).toEqual([0,2,1]);
        expect(filtered.levels).toEqual(x.levels);
    }

    // With a buffer.
    {
        let buffer = new Int32Array(2);

        let filtered = scran.subsetFactor(x, [1, 4], { buffer: buffer });
        expect(Array.from(filtered.ids)).toEqual([0,0]);
        expect(filtered.levels).toEqual(["y"]);

        filtered = scran.subsetFactor(x, [1, 4], { buffer: buffer, drop: false });
        expect(Array.from(filtered.ids)).toEqual([1,1]);
        expect(filtered.levels).toEqual(x.levels);
    }
})

