import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("hypergeometricTest works as expected with numeric inputs", () => {
    let out = scran.hypergeometricTest(6, 30, 20, 100);
    expect(out.length).toEqual(1);
    expect(out[0]).toBeCloseTo(0.3849201, 0.01); // phyper(6,20,80,30, lower.tail=FALSE)

    let out2 = scran.hypergeometricTest(19, 80, 50, 500);
    expect(out2.length).toEqual(1);
    expect(out2[0]).toBeCloseTo(7.913983e-11, 0.01); // phyper(19,80,920,50, lower.tail=FALSE)
})

test("hypergeometricTest works as expected with array inputs", () => {
    {
        let out = scran.hypergeometricTest([1,2,3,4,5,6], 30, 20, 100);
        expect(out[0]).toEqual(scran.hypergeometricTest(1, 30, 20, 100)[0]);
        expect(out[5]).toEqual(scran.hypergeometricTest(6, 30, 20, 100)[0]);
    }

    {
        let out = scran.hypergeometricTest([1,2,3,4,5,6], [60, 50, 40, 30, 20, 10], 10, 100);
        expect(out[0]).toEqual(scran.hypergeometricTest(1, 60, 10, 100)[0]);
        expect(out[5]).toEqual(scran.hypergeometricTest(6, 10, 10, 100)[0]);
    }

    expect(scran.hypergeometricTest([], [], 10, 20)).toEqual(new Float64Array(0)); 
    expect(() => scran.hypergeometricTest([1,2,3], [60, 50, 40, 30, 20, 10], 10, 100)).toThrow("array inputs");
})
