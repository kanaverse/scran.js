import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("neighbor index building works with various inputs", () => {
    var ngenes = 1000;
    var ncells = 100;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var pca = scran.runPca(mat);

    // Trying with the PCs.
    var index = scran.buildNeighborSearchIndex(pca);
    expect(index instanceof scran.BuildNeighborSearchIndexResults).toBe(true);
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
    expect(dump.runs[0]).toBe(k);
    expect(dump.runs[ncells-1]).toBe(k);
    expect(dump.indices.length).toBe(ncells * k);
    expect(dump.distances.length).toBe(ncells * k);

    // Reconstituting.
    var res2 = scran.FindNearestNeighborsResults.unserialize(dump.runs, dump.indices, dump.distances);
    var dump2 = res2.serialize();

    expect(compare.equalArrays(dump.runs, dump2.runs)).toBe(true);
    expect(compare.equalArrays(dump.indices, dump2.indices)).toBe(true);
    expect(compare.equalArrays(dump.distances, dump2.distances)).toBe(true);

    // Using pre-specified buffers.
    let buf_runs = scran.createInt32WasmArray(res.numberOfCells());
    let buf_indices = scran.createInt32WasmArray(res.size());
    let buf_distances = scran.createFloat64WasmArray(res.size());

    let dump3 = res.serialize({ runs: buf_runs, indices: buf_indices, distances: buf_distances });
    expect(compare.equalArrays(dump.runs, dump3.runs)).toBe(true);
    expect(compare.equalArrays(dump.indices, dump3.indices)).toBe(true);
    expect(compare.equalArrays(dump.distances, dump3.distances)).toBe(true);

    // Cleaning up.
    buffer.free();
    index.free();

    res.free();
    res2.free();

    buf_runs.free();
    buf_indices.free();
    buf_distances.free();
});

test("neighbor search can be truncated", () => {
    var ndim = 5;
    var ncells = 100;
    var buffer = scran.createFloat64WasmArray(ndim * ncells);
    var arr = buffer.array();
    arr.forEach((x, i) => arr[i] = Math.random());

    var index = scran.buildNeighborSearchIndex(buffer, { numberOfDims: ndim, numberOfCells: ncells });
    var k = 5;
    var res = scran.findNearestNeighbors(index, k);
    var dump = res.serialize();

    var tres = scran.truncateNearestNeighbors(res, 2);
    var tdump = tres.serialize();
    expect(tdump.runs.length).toBe(ncells);
    expect(tdump.runs[0]).toBe(2);
    expect(tdump.runs[ncells-1]).toBe(2);
    expect(tdump.indices.length).toBe(ncells * 2);
    expect(tdump.distances.length).toBe(ncells * 2);

    // Checking that the neighbors are the same.
    expect(tdump.indices[0]).toEqual(dump.indices[0]);
    expect(tdump.indices[2]).toEqual(dump.indices[5]);
    expect(tdump.indices[5]).toEqual(dump.indices[11]);
    expect(tdump.indices[51]).toEqual(dump.indices[126]);

    // Checking we get the same results with truncated serialization.
    var tdump2 = res.serialize({ truncate: 2 });
    expect(tdump2.runs).toEqual(tdump.runs);
    expect(tdump2.indices).toEqual(tdump.indices);
    expect(tdump2.distances).toEqual(tdump.distances);
})
