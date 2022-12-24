import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("PCA works as expected", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);

    var pca = scran.runPCA(mat, { numberOfPCs: 20 });
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

    var pca = scran.runPCA(mat, { features: feat, numberOfPCs: 15 });
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
    for (var i = 0; i < ncells; i++) {
        block[i] = Math.floor(Math.random() * nblocks);
    }
    for (var j = 0; j < nblocks; j++) {
        block[j] = j;
    }

    var pca = scran.runPCA(mat, { features: feat, numberOfPCs: 15 });

    var blocked = scran.runPCA(mat, { features: feat, numberOfPCs: 15, block: block });
    expect(pca.numberOfPCs()).toBe(blocked.numberOfPCs());
    expect(pca.numberOfCells()).toBe(blocked.numberOfCells());
    expect(compare.equalFloatArrays(pca.principalComponents(), blocked.principalComponents())).toBe(false);

    var weighted = scran.runPCA(mat, { features: feat, numberOfPCs: 15, block: block, blockMethod: "weight" });
    expect(pca.numberOfPCs()).toBe(weighted.numberOfPCs());
    expect(pca.numberOfCells()).toBe(weighted.numberOfCells());
    expect(compare.equalFloatArrays(pca.principalComponents(), weighted.principalComponents())).toBe(false);

    var none = scran.runPCA(mat, { features: feat, numberOfPCs: 15, block: block, blockMethod: "none" });
    expect(pca.numberOfPCs()).toBe(none.numberOfPCs());
    expect(pca.numberOfCells()).toBe(none.numberOfCells());
    expect(compare.equalFloatArrays(pca.principalComponents(), none.principalComponents())).toBe(true);

    expect(() => scran.runPCA(mat, { features: feat, numberOfPCs: 15, block: block, blockMethod: "foobar" })).toThrow("should be one of");
});

test("PCA results can be mocked up", () => {
    var npcs = 25;
    var ncells = 1234;

    let dummy = scran.emptyRunPCAResults(ncells, npcs);

    expect(() => dummy.principalComponents()).toThrow("fillable");
    let pcs = dummy.principalComponents({ fillable: true });
    pcs[0] = 5;
    pcs[npcs * ncells - 1] = 100;

    let pcs2 = dummy.principalComponents();
    expect(pcs2[0]).toEqual(5);
    expect(pcs2[npcs * ncells - 1]).toEqual(100);

    expect(() => dummy.varianceExplained()).toThrow("fillable");
    let ve = dummy.varianceExplained({ fillable: true });
    ve[0] = 100;
    ve[npcs - 1] = 1;

    let ve2 = dummy.varianceExplained();
    expect(ve2[0]).toEqual(100);
    expect(ve2[npcs - 1]).toEqual(1);

    expect(() => dummy.totalVariance()).toThrow("setTotalVariance");
    dummy.setTotalVariance(200);
    expect(dummy.totalVariance()).toEqual(200);
})
