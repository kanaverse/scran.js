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
    expect(graph instanceof scran.BuildSNNGraphResults).toBe(true);

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

    // Responds to the resolution specification.
    var clusters3 = scran.clusterSNNGraph(graph2, { resolution: 0.5 });
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

test("clusterSNNGraph works with other clustering methods", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    var k = 5;
    var res = scran.findNearestNeighbors(index, k);
    var graph = scran.buildSNNGraph(res);

    var clusters = scran.clusterSNNGraph(graph, { method: "walktrap" });
    expect(clusters instanceof scran.ClusterSNNGraphWalktrapResults);
    expect(clusters.numberOfMergeSteps()).toBeGreaterThan(0);
    var clust = clusters.membership();
    expect(clust.length).toBe(ncells);

    var clusters2 = scran.clusterSNNGraph(graph, { method: "leiden" });
    expect(clusters2 instanceof scran.ClusterSNNGraphLeidenResults);
    var clust = clusters2.membership();
    expect(clust.length).toBe(ncells);

    clusters.free();
    clusters2.free();
})

test("clusterSNNGraph results can be mocked up", () => {
    {
        let x = scran.emptyClusterSNNGraphResults(1234, { numberOfLevels: 2 });
        expect(x.numberOfLevels()).toBe(2);

        expect(() => x.best()).toThrow("setBest");
        x.setBest(1);
        expect(() => x.modularity(0)).toThrow("setModularity");
        x.setModularity(0, 5);
        x.setModularity(1, 10);
        expect(x.modularity()).toBe(10);
        expect(x.modularity({ level: 0 })).toBe(5);

        expect(() => x.membership()).toThrow("fillable");
        let mem = x.membership({ fillable: true });
        mem[0] = 100;
        mem[1233] = 1000;
        let mem2 = x.membership(); 
        expect(mem2[0]).toEqual(100);
        expect(mem2[1233]).toEqual(1000);
    }

    {
        let x = scran.emptyClusterSNNGraphResults(1234, { method: "walktrap", numberOfMergeSteps: 3 });
        expect(x.numberOfMergeSteps()).toBe(3);

        expect(() => x.membership()).toThrow("fillable");
        let mem = x.membership({ fillable: true });
        mem[0] = 100;
        mem[1233] = 1000;
        let mem2 = x.membership(); 
        expect(mem2[0]).toEqual(100);
        expect(mem2[1233]).toEqual(1000);

        expect(() => x.modularity()).toThrow("setModularity");
        x.setModularity(0, 1);
        x.setModularity(1, 10);
        x.setModularity(2, 100);
        x.setModularity(3, 1000);
        expect(x.modularity()).toBe(1000);
        expect(x.modularity({ at: 0 })).toBe(1);
    }

    {
        let x = scran.emptyClusterSNNGraphResults(1234, { method: "leiden" });

        expect(() => x.membership()).toThrow("fillable");
        let mem = x.membership({ fillable: true });
        mem[0] = 100;
        mem[1233] = 1000;
        let mem2 = x.membership(); 
        expect(mem2[0]).toEqual(100);
        expect(mem2[1233]).toEqual(1000);

        expect(() => x.modularity()).toThrow("setModularity");
        x.setModularity(100);
        expect(x.modularity()).toBe(100);
    }
})

