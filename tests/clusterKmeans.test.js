import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

function checkClusterConsistency(res, ncells, k) {
    var clust = res.clusters();
    expect(clust.length).toBe(ncells);

    let counts = res.clusterSizes();
    expect(counts.length).toBe(k);
    clust.forEach(x => {
        --(counts[x]);
    });
    for (const c of counts) {
        expect(c).toBe(0);
    }
}

test("clusterKmeans works as expected from an array", () => {
    var ndim = 5;
    var ncells = 100;
    var pcs = simulate.simulatePCs(ndim, ncells);

    var k = 5;
    var res = scran.clusterKmeans(pcs, k, { numberOfCells: ncells, numberOfDims: ndim });

    expect(res.numberOfCells()).toBe(ncells);
    expect(res.numberOfClusters()).toBe(k);
    checkClusterConsistency(res, ncells, k);

    var wcss = res.withinClusterSumSquares();
    expect(wcss.length).toBe(k);
    for (const w of wcss) {
        expect(w > 0).toBe(true);
    }

    // Other odds and ends.
    expect(res.iterations() > 0).toBe(true);
    expect(res.status()).toBe(0);

    // Cleaning up.
    res.free();
    pcs.free();
});

test("clusterKmeans works as expected from PCs", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var pca = scran.runPCA(mat);

    // Trying with the PCs.
    var auto = scran.clusterKmeans(pca, 10);
    var manual = scran.clusterKmeans(pca.principalComponents(), 10, { numberOfCells: ncells, numberOfDims: pca.numberOfPCs() });

    expect(compare.equalArrays(auto.clusters(), manual.clusters())).toBe(true);
    expect(compare.equalArrays(auto.clusterCenters(), manual.clusterCenters())).toBe(true);
    expect(compare.equalArrays(auto.withinClusterSumSquares(), manual.withinClusterSumSquares())).toBe(true);
});

test("clusterKmeans works with other options", () => {
    var ndim = 5;
    var ncells = 100;
    var pcs = simulate.simulatePCs(ndim, ncells);

    var k = 5;
    var res = scran.clusterKmeans(pcs, k, { numberOfCells: ncells, numberOfDims: ndim, initMethod: "kmeans++" });
    checkClusterConsistency(res, ncells, k);

    var res2 = scran.clusterKmeans(pcs, k, { numberOfCells: ncells, numberOfDims: ndim, initMethod: "random" });
    checkClusterConsistency(res2, ncells, k);
});
