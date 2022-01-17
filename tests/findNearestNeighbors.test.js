import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as simulate from "./simulate.js";

test("neighbor search works as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var buffer = new scran.Float64WasmArray(ndim * ncells);
    var arr = buffer.array();
    arr.forEach((x, i) => arr[i] = Math.random());

    var index = scran.buildNeighborSearchIndex(buffer, ndim, ncells);
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
