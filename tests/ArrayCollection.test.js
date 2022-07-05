import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("validating an array collection works", () => {
    let x = { "A": [ 1, 2, 3, 4 ], "B": [ 'x', 'y', 'z', 'aa' ] };
    scran.validateArrayCollection(x)

    x.A.push(5);
    expect(() => scran.validateArrayCollection(x)).toThrow("should have equilength");

    x.B = scran.createFloat64WasmArray(5);
    expect(() => scran.validateArrayCollection(x)).toThrow("should not contain");

    x.B.free();
})

test("subsetting an array collection works", () => {
    let x = { "A": [ 1, 2, 3, 4 ], "B": [ 'x', 'y', 'z', 'aa' ] };
    let out = scran.subsetArrayCollection(x, [3, 1, 2]);
    expect(out.A).toEqual([4,2,3]);
    expect(out.B).toEqual(['aa','y','z']);

    // Works with subset vectors.
    out = scran.subsetArrayCollection(x, [1, 0, 0, 1], { filter: false });
    expect(out.A).toEqual([1,4]);
    expect(out.B).toEqual(['x','aa']);

    out = scran.subsetArrayCollection(x, [0, 0, 0, 1], { filter: true });
    expect(out.A).toEqual([1,2,3]);
    expect(out.B).toEqual(['x','y','z']);

    expect(() => scran.subsetArrayCollection(x, [0, 0, 1], { filter: true })).toThrow("same length");
})

test("subsetting an array collection works with WasmArray inputs", () => {
    let x = { "A": [ 1, 2, 3, 4 ], "B": [ 'x', 'y', 'z', 'aa' ] };
    let sub = scran.createInt32WasmArray(4);
    sub.set([3,2,1,0]);
    let out = scran.subsetArrayCollection(x, sub);
    expect(out.A).toEqual([4,3,2,1]);
    expect(out.B).toEqual(['aa','z','y','x']);

    // Works with subset vectors.
    sub.set([1,0,0,0]);
    out = scran.subsetArrayCollection(x, sub, { filter: true });
    expect(out.A).toEqual([2,3,4]);
    expect(out.B).toEqual(['y','z','aa']);

    sub.free();
})

test("splitting an array collection works", () => {
    let x = { "A": [ 1, 2, 3, 4 ], "B": [ 'x', 'y', 'z', 'aa' ] };
    let out = scran.splitArrayCollection(x, scran.splitByFactor([ "foo", "bar", "bar", "foo" ]));
    expect(out.foo).toEqual({ "A": [ 1, 4 ], "B": [ "x", "aa" ] });
    expect(out.bar).toEqual({ "A": [ 2, 3 ], "B": [ "y", "z" ] });
})

test("combining multiple array collections works", () => {
    // Simple case.
    let x = { "A": [ 1, 2, 3, 4 ], "B":[ 'x', 'y', 'z', 'aa' ]};
    let y = { "A": [ 5, 6 ], "B":[ 'bb', 'cc' ]};
    {
        let out = scran.combineArrayCollections([x, y]);
        expect(out.A).toEqual([1,2,3,4,5,6]);
        expect(out.B).toEqual(["x", "y", "z", "aa", "bb", "cc"]);
    }

    // Missing columns.
    let z = { "A": [5, 6] };
    {
        let out = scran.combineArrayCollections([x, z, y]);
        expect(out.A).toEqual([1,2,3,4,5,6,5,6]);
        expect(out.B).toEqual(["x", "y", "z", "aa", null, null, "bb", "cc"]);
    }

    // Checks the lengths.
    expect(() => scran.combineArrayCollections([x, z, y], { lengths: [1] })).toThrow("same length");
    expect(() => scran.combineArrayCollections([x, z, y], { lengths: [4,2,1] })).toThrow("mismatch in lengths");
    {
        let out = scran.combineArrayCollections([x, z, y], { lengths: [4,2,2] });
        expect(out.A).toEqual([1,2,3,4,5,6,5,6]);
    }

    // Mandates lengths if one is empty.
    expect(() => scran.combineArrayCollections([x, {}, y])).toThrow("must be non-empty");
    {
        let out = scran.combineArrayCollections([x, {}, y], { lengths: [4,3,2] });
        expect(out.A).toEqual([1,2,3,4,null,null,null,5,6]);
    }
})

test("combining multiple array collections preserves TypedArray types", () => {
    let x = { "A": new Float64Array([ 1, 2, 3, 4 ]), "B":[ 'x', 'y', 'z', 'aa' ]};
    let y = { "A": new Float64Array([ 5, 6 ]), "B":[ 'bb', 'cc' ]};

    let out = scran.combineArrayCollections([x, y]);
    expect(out.A.constructor.name).toBe("Float64Array");
    expect(out.A).toEqual(new Float64Array([1,2,3,4,5,6]));
    expect(out.B).toEqual(["x", "y", "z", "aa", "bb", "cc"]);

    // Falls back if there's a difference in types.
    y.A = new Int32Array([5,6]);
    out = scran.combineArrayCollections([x, y]);
    expect(out.A.constructor.name).toBe("Array");
    expect(out.A).toEqual([1,2,3,4,5,6]);

    // Or if it's missing.
    delete y.A;
    out = scran.combineArrayCollections([x, y]);
    expect(out.A.constructor.name).toBe("Array");
    expect(out.A).toEqual([1,2,3,4,null,null]);
})

