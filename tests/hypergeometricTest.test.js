import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

function reldiff(observed, expected) {
    return Math.abs(observed - expected) / (Math.abs(observed + expected))/2;
}

test("hypergeometricTest works as expected with numeric inputs", () => {
    let out = scran.hypergeometricTest(6, 30, 20, 100).slice();
    expect(out.length).toEqual(1);
    expect(reldiff(out[0], 0.5990112)).toBeLessThan(0.01); // phyper(5,20,80,30, lower.tail=FALSE), using 6 - 1 to include the PMF of 6 itself in the upper tail.

    let out2 = scran.hypergeometricTest(19, 80, 50, 500).slice();
    expect(out2.length).toEqual(1);
    expect(reldiff(out2[0], 5.360675e-05)).toBeLessThan(0.01); // phyper(18,80,420,50, lower.tail=FALSE)
})

test("hypergeometricTest works as expected with array inputs", () => {
    {
        let out = scran.hypergeometricTest([1,2,3,4,5,6], 30, 20, 100).slice();
        expect(out[0]).toEqual(scran.hypergeometricTest(1, 30, 20, 100).slice()[0]);
        expect(out[5]).toEqual(scran.hypergeometricTest(6, 30, 20, 100).slice()[0]);
    }

    {
        let out = scran.hypergeometricTest([1,2,3,4,5,6], [60, 50, 40, 30, 20, 10], 10, 100).slice();
        expect(out[0]).toEqual(scran.hypergeometricTest(1, 60, 10, 100).slice()[0]);
        expect(out[5]).toEqual(scran.hypergeometricTest(6, 10, 10, 100).slice()[0]);
    }

    expect(scran.hypergeometricTest([], [], 10, 20).slice()).toEqual(new Float64Array(0)); 
    expect(() => scran.hypergeometricTest([1,2,3], [60, 50, 40, 30, 20, 10], 10, 100)).toThrow("array inputs");
})
