import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

test("Neighbor index building works as expected", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var pca = scran.runPCA(mat);

    // Trying with the PCs.
    var index = scran.buildNeighborSearchIndex(pca);
    expect(index instanceof scran.NeighborSearchIndex).toBe(true);

    // Trying again with a buffer.
    var buffer = new scran.Float64WasmArray(pca.numberOfPCs() * ncells);
    buffer.set(pca.principalComponents(false));
    var index2 = scran.buildNeighborSearchIndex(buffer, pca.numberOfPCs(), ncells);

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
