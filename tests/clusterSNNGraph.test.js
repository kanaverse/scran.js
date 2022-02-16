import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("clusterSNNGraph works as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    var k = 5;
    var res = scran.findNearestNeighbors(index, k);
    var graph = scran.buildSNNGraph(res);
    expect(graph instanceof scran.SNNGraph).toBe(true);

    var clusters = scran.clusterSNNGraph(graph);
    var clust = clusters.membership();
    expect(clust.length).toBe(ncells);
    expect(clusters.best() < clusters.numberOfLevels()).toBe(true);
    expect(clusters.modularity() > 0).toBe(true);
    
    // Same results with index input.
    var graph2 = scran.buildSNNGraph(index, { neighbors: k });
    var clusters2 = scran.clusterSNNGraph(graph2);
    var clust2 = clusters2.membership();
    expect(compare.equalArrays(clust2, clust)).toBe(true);

    // Cleaning up.
    index.free();
    res.free();
    graph.free();
    clusters.free();
    graph2.free();
    clusters2.free();
});
