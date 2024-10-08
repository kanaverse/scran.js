import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("scoreGsdecon works as expected with Uint8Array inputs", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    let features = new Uint8Array(ngenes);
    features.fill(1, 10, 20);

    let scores = scran.scoreGsdecon(norm, features);
    expect(scores.scores.length).toEqual(ncells);
    expect(scores.weights.length).toEqual(10); 

    expect(() => scran.scoreGsdecon(norm, features.slice(0, 10))).toThrow("number of rows");
})

test("scoreGsdecon gives different results after scaling", () => {
    var ngenes = 1000;
    var ncells = 20;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    let features = new Uint8Array(ngenes);
    features.fill(1, 10, 20);

    let scores = scran.scoreGsdecon(norm, features);
    let scaled = scran.scoreGsdecon(norm, features, { scale: true });
    expect(scores.weights).not.toEqual(scaled.weights);
    expect(scores.scores).not.toEqual(scaled.scores);
})

test("scoreGsdecon works with blocking", () => {
    var ngenes = 1000;
    var ncells = 50;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);

    let features = new Uint8Array(ngenes);
    features.fill(1, 0, 5);

    let half = 20;
    var block = scran.createInt32WasmArray(ncells);
    block.fill(0, 0, half);
    block.fill(1, half, ncells);

    let scores = scran.scoreGsdecon(norm, features, { block });
    expect(scores.scores.length).toEqual(ncells);
    expect(scores.weights.length).toEqual(5); 

    expect(() => scran.scoreGsdecon(norm, features, { block: block.slice(0, 10) })).toThrow("number of columns");
})

