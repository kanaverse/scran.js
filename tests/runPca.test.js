import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("PCA works as expected", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var pca = scran.runPca(mat, { numberOfPCs: 20 });
    expect(pca.principalComponents().length).toBe(ncells * 20);
    expect(pca.varianceExplained().length).toBe(20);
    expect(pca.totalVariance() > 0).toBe(true);

    // Mopping up.
    mat.free();
    pca.free();
});

test("PCA works as expected with feature subsetting", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var feat = new Array(ngenes);
    for (var i = 0; i < ngenes; i++) {
        feat[i] = Math.random() < 0.05;
    }

    var pca = scran.runPca(mat, { features: feat, numberOfPCs: 15 });
    expect(pca.principalComponents().length).toBe(ncells * 15);
    expect(pca.varianceExplained().length).toBe(15);
    expect(pca.totalVariance() > 0).toBe(true);

    // Mopping up.
    mat.free();
    pca.free();
});

test("PCA works as expected with blocking", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var feat = new Array(ngenes);
    for (var i = 0; i < ngenes; i++) {
        feat[i] = Math.random() < 0.05;
    }

    var block = new Int32Array(ncells);
    var nblocks = 4;
    var i = 0;
    while (i < ncells) {
        for (var b = 0; b < nblocks; b++) {
            for (var j = 0; j <= b && i < ncells; j++) {
                block[i] = b;
                ++i;
            }
        }
    }

    var pca = scran.runPca(mat, { features: feat, numberOfPCs: 15 });

    var blocked = scran.runPca(mat, { features: feat, numberOfPCs: 15, block: block });
    expect(pca.numberOfPCs()).toBe(blocked.numberOfPCs());
    expect(pca.numberOfCells()).toBe(blocked.numberOfCells());
    expect(compare.equalFloatArrays(pca.principalComponents(), blocked.principalComponents())).toBe(false);

    var weighted = scran.runPca(mat, { features: feat, numberOfPCs: 15, block: block, blockMethod: "project" });
    expect(pca.numberOfPCs()).toBe(weighted.numberOfPCs());
    expect(pca.numberOfCells()).toBe(weighted.numberOfCells());
    expect(compare.equalFloatArrays(pca.principalComponents(), weighted.principalComponents())).toBe(false);

    var none2 = scran.runPca(mat, { features: feat, numberOfPCs: 15, block: block, blockMethod: "none", blockWeightPolicy: "none" });
    expect(pca.numberOfPCs()).toBe(none2.numberOfPCs());
    expect(pca.numberOfCells()).toBe(none2.numberOfCells());
    expect(compare.equalArrays(pca.principalComponents(), none2.principalComponents())).toBe(true); // should be exactly equal.

    expect(() => scran.runPca(mat, { features: feat, numberOfPCs: 15, block: block, blockMethod: "foobar" })).toThrow("should be one of");
});
