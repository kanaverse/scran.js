import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("testFeatureSetEnrichment works as expected with array inputs", () => {
    let output = scran.testFeatureSetEnrichment([0,2,4,6,8], [[0,2,4], [0,1,2,3,4,5,6,7,8,9], [1,3,5,7,9]], { totalFeatures: 10 });

    expect(output.count).toEqual(new Int32Array([3, 5, 0]));
    expect(output.size).toEqual(new Int32Array([3, 10, 5]));

    expect(output.pvalue[0]).toEqual(scran.hypergeometricTest(3, 5, 3, 10)[0]);
    expect(output.pvalue[1]).toEqual(scran.hypergeometricTest(5, 5, 10, 10)[0]);
    expect(output.pvalue[2]).toEqual(scran.hypergeometricTest(0, 5, 5, 10)[0]);

    expect(() => scran.testFeatureSetEnrichment([0, 2, 4, 6, 8], [0, 1, 2, 3])).toThrow("totalFeatures");
})

test("testFeatureSetEnrichment works as expected with Uint8Array inputs", () => {
    let markers = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
    let output = scran.testFeatureSetEnrichment(markers,
        [
            new Uint8Array([1, 0, 1, 0, 1, 0, 0, 0, 0, 0]),
            new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
            new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1, 0, 1])
        ]
    );

    expect(output.count).toEqual(new Int32Array([3, 5, 0]));
    expect(output.size).toEqual(new Int32Array([3, 10, 5]));

    expect(output.pvalue[0]).toEqual(scran.hypergeometricTest(3, 5, 3, 10)[0]);
    expect(output.pvalue[1]).toEqual(scran.hypergeometricTest(5, 5, 10, 10)[0]);
    expect(output.pvalue[2]).toEqual(scran.hypergeometricTest(0, 5, 5, 10)[0]);

    expect(() => scran.testFeatureSetEnrichment(markers, [ new Uint8Array([0, 1, 2, 3]) ] )).toThrow("total number of features");
})
