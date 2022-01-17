import * as scran from "../js/index.js";

test("clusterSNNGraph works as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var buffer = new scran.Float64WasmArray(ndim * ncells);
    var arr = buffer.array();
    arr.forEach((x, i) => arr[i] = Math.random());

    var index = scran.buildNeighborSearchIndex(buffer, ndim, ncells);
    var k = 5;
    var res = scran.findNearestNeighbors(index, k);
    var graph = scran.buildSNNGraph(res);

    var clusters = scran.clusterSNNGraph(graph);
    var clust = clusters.membership();
    expect(clust.length).toBe(ncells);
    expect(clusters.best() < clusters.numberOfLevels()).toBe(true);
    expect(clusters.modularity() > 0).toBe(true);

    // Cleaning up.
    buffer.free();
    index.free();
    res.free();
    graph.free();
    clusters.free();
});
