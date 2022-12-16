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

test("clusterKmeans results can be mocked up", () => {
    var ndim = 5;
    var nclust = 3;
    var ncells = 100;

    let mock = scran.emptyClusterKmeansResults(ncells, nclust, ndim);
    expect(mock.numberOfCells()).toBe(ncells);
    expect(mock.numberOfClusters()).toBe(nclust);

    {
        let x = mock.clusters({ copy: false });
        x[0] = 1;
        x[ncells - 1] = 5;
        let y = mock.clusters();
        expect(y[0]).toBe(1);
        expect(y[ncells-1]).toBe(5);
    }

    {
        let x = mock.clusterSizes({ copy: false });
        x[0] = 100;
        x[nclust - 1] = 200;
        let y = mock.clusterSizes();
        expect(y[0]).toBe(100);
        expect(y[nclust - 1]).toBe(200);
    }

    {
        mock.setIterations(5);
        expect(mock.iterations()).toEqual(5);
        mock.setStatus(2);
        expect(mock.status()).toEqual(2);
    }
})
