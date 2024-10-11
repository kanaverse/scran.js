import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

var ncells = 100;
var block = new Array(ncells);
var half = ncells / 2;
block.fill(0, 0, half);
block.fill(1, half, ncells);

test("mnnCorrect works as expected", () => {
    var ngenes = 1000;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var pca = scran.runPca(mat);

    var output = scran.mnnCorrect(pca, block);
    expect(output.length).toBe(pca.numberOfPCs() * pca.numberOfCells());

    // Checking that it's all filled with something.
    expect(output[0] != 0).toBe(true);
    expect(output[output.length - 1] != 0).toBe(true);

    // Checking that it actually did change the PCs.
    expect(compare.equalFloatArrays(output, pca.principalComponents())).toBe(false);

    // Mopping up.
    mat.free();
    pca.free();
})

test("mnnCorrect works as expected with array inputs, presupplied buffer", () => {
    var ngenes = 1000;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var pca = scran.runPca(mat);
    var ref = scran.mnnCorrect(pca, block);

    var output = scran.createFloat64WasmArray(pca.numberOfPCs() * pca.numberOfCells());
    scran.mnnCorrect(pca.principalComponents(), block, { asTypedArray: false, buffer: output, numberOfDims: pca.numberOfPCs(), numberOfCells: pca.numberOfCells() });
    expect(compare.equalArrays(ref, output.array())).toBe(true);

    // Mopping up.
    mat.free();
    pca.free();
    output.free();
})
