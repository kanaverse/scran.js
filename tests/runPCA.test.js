import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";

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
