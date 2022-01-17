import * as scran from "../js/index.js";

test("buildSNNGraph works as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var buffer = new scran.Float64WasmArray(ndim * ncells);
    var arr = buffer.array();
    arr.forEach((x, i) => arr[i] = Math.random());

    var index = scran.buildNeighborSearchIndex(buffer, ndim, ncells);
    var k = 5;
    var res = scran.findNearestNeighbors(index, k);

    var graph = scran.buildSNNGraph(res);
    expect(graph instanceof scran.SNNGraph).toBe(true);

    // Cleaning up.
    buffer.free();
    res.free();
    graph.free();
    index.free();
});
