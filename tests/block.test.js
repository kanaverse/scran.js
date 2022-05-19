import * as scran from "../js/index.js";

//test("block creation works", () => {
//    {
//        let out = scran.createBlock([4,3]);
//        expect(out.array()).toEqual([0,0,0,0,1,1,1]);
//        out.free();
//    }
//
//    // Works with empty stuff.
//    {
//        let out = scran.createBlock([0,1,2,3]);
//        expect(out.array()).toEqual([1,2,2,3,3,3]);
//        out.free();
//    }
//
//    // Works with a buffer.
//    {
//        let buffer = scran.createInt32WasmArray(5)
//        scran.createBlock([2,3], { buffer: buffer });
//        expect(buffer.array()).toEqual([0,0,1,1,1]);
//        buffer.free();
//
//        expect(() => scran.createBlock([2,1], { buffer: buffer })).toThrow("length");
//    }
//})
//
//test("block conversion works", () => {
//    {
//        let out = scran.convertBlock(["A", "A", "B", "B", "B"]);
//        expect(out.ids.array()).toEqual([0,0,1,1,1]);
//        expect(out.levels).toEqual(["A", "B"]);
//        out.free();
//    }
//
//    // Respects the input order.
//    {
//        let out = scran.convertBlock(["B", "B", "B", "A", "A"]);
//        expect(out.ids.array()).toEqual([0,0,0,1,1]);
//        expect(out.levels).toEqual(["B", "A"]);
//        out.free();
//    }
//
//    // Works with TypedArrays.
//    {
//        let thing = new Int32Array(5);
//        thing.set([2,1,0,1,2]);
//        let out = scran.convertBlock(thing);
//        expect(out.ids.array()).toEqual([0,1,2,1,0]);
//        expect(out.levels).toEqual([2,1,0]);
//        out.free();
//    }
//
//    // Works with a buffer.
//    {
//        let buffer = scran.createInt32WasmArray(5)
//        scran.convertBlock(["B", "B", "C", "A", "A"]);
//        expect(buffer.array()).toEqual([0,0,1,2,2]);
//        buffer.free();
//
//        expect(() => scran.convertBlock([2,1], { buffer: buffer })).toThrow("length");
//    }
//})
