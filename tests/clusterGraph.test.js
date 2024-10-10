import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("clusterGraph works as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    var k = 5;
    var res = scran.findNearestNeighbors(index, k);
    var graph = scran.buildSnnGraph(res);
    expect(graph instanceof scran.BuildSnnGraphResults).toBe(true);

    var clusters = scran.clusterGraph(graph);
    var clust = clusters.membership();
    expect(clust.length).toBe(ncells);
    expect(clusters.bestLevel()).toBeLessThan(clusters.numberOfLevels());
    expect(clusters.modularity()).toBeGreaterThan(0);

    // Same results with index input.
    var graph2 = scran.buildSnnGraph(index, { neighbors: k });
    var clusters2 = scran.clusterGraph(graph2);
    var clust2 = clusters2.membership();
    expect(compare.equalArrays(clust2, clust)).toBe(true);

    // Responds to the resolution specification.
    var clusters3 = scran.clusterGraph(graph2, { multiLevelResolution: 0.5 });
    var clust3 = clusters3.membership();
    expect(compare.equalArrays(clust2, clust3)).toBe(false);

    // Cleaning up.
    index.free();
    res.free();
    graph.free();
    clusters.free();
    graph2.free();
    clusters2.free();
    clusters3.free();
});

test("clusterGraph works with other clustering methods", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    var k = 5;
    var res = scran.findNearestNeighbors(index, k);
    var graph = scran.buildSnnGraph(res);

    var clusters = scran.clusterGraph(graph, { method: "walktrap" });
    expect(clusters instanceof scran.ClusterWalktrapResults);
    expect(clusters.numberOfMergeSteps()).toBeGreaterThan(0);
    var clust = clusters.membership();
    expect(clust.length).toBe(ncells);

    var clusters2 = scran.clusterGraph(graph, { method: "leiden" });
    expect(clusters2 instanceof scran.ClusterLeidenResults);
    var clust = clusters2.membership();
    expect(clust.length).toBe(ncells);

    clusters.free();
    clusters2.free();
})
