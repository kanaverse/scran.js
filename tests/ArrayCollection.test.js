import * as scran from "../js/index.js";

test("slicing an array collection works", () => {
    let x = { "A": [ 1, 2, 3, 4 ], "B": [ 'x', 'y', 'z', 'aa' ] };
    let out = scran.sliceArrayCollection(x, [3, 1, 2]);
    expect(out.A).toEqual([4,2,3]);
    expect(out.B).toEqual(['aa','y','z']);
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
