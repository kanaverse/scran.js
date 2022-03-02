import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("neighbor index building works with various inputs", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var pca = scran.runPCA(mat);

    // Trying with the PCs.
    var index = scran.buildNeighborSearchIndex(pca);
    expect(index instanceof scran.NeighborSearchIndex).toBe(true);
    expect(index.numberOfCells()).toBe(ncells);

    // Trying again with a buffer.
    var buffer = scran.createFloat64WasmArray(pca.numberOfPCs() * ncells);
    buffer.set(pca.principalComponents(false));
    var index2 = scran.buildNeighborSearchIndex(buffer, { numberOfDims: pca.numberOfPCs(), numberOfCells: ncells });

    // Extracting data.
    var k = 5;
    var res1 = scran.findNearestNeighbors(index, k);
    var res2 = scran.findNearestNeighbors(index2, k);

    expect(res1.numberOfCells()).toBe(ncells);
    expect(res2.numberOfCells()).toBe(ncells);
    expect(res1.size()).toBe(ncells * k);
    expect(res2.size()).toBe(ncells * k);

    var first = res1.serialize();
    var second = res2.serialize();

    expect(compare.equalArrays(first.runs, second.runs)).toBe(true);
    expect(compare.equalArrays(first.indices, second.indices)).toBe(true);
    expect(compare.equalArrays(first.distances, second.distances)).toBe(true);

    // Mopping up.
    index.free();
    buffer.free();
    index2.free();
    res1.free();
    res2.free();
});

test("neighbor search works with serialization", () => {
    var ndim = 5;
    var ncells = 100;
    var buffer = scran.createFloat64WasmArray(ndim * ncells);
    var arr = buffer.array();
    arr.forEach((x, i) => arr[i] = Math.random());

    var index = scran.buildNeighborSearchIndex(buffer, { numberOfDims: ndim, numberOfCells: ncells });
    var k = 5;
    var res = scran.findNearestNeighbors(index, k);

    // Dumping.
    var dump = res.serialize();
    expect(dump.runs.length).toBe(ncells);
    expect(dump.indices.length).toBe(ncells * k);
    expect(dump.distances.length).toBe(ncells * k);

    // Reconstituting.
    var res2 = scran.NeighborSearchResults.unserialize(dump.runs, dump.indices, dump.distances);
    var dump2 = res2.serialize();

    expect(compare.equalArrays(dump.runs, dump2.runs)).toBe(true);
    expect(compare.equalArrays(dump.indices, dump2.indices)).toBe(true);
    expect(compare.equalArrays(dump.distances, dump2.distances)).toBe(true);

    // Cleaning up.
    buffer.free();
    index.free();
    res.free();
    res2.free();
});
