import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("runUmap works as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    // Initializing and running the algorithm.
    var init = scran.initializeUmap(index, { epochs: 500 });
    var start = init.extractCoordinates();
    expect(init.currentEpoch()).toBe(0);
    expect(init.totalEpochs()).toBe(500);
    expect(init.numberOfCells()).toBe(ncells);

    init.run();
    var finished = init.extractCoordinates();
    expect(init.currentEpoch()).toBe(500);

    // Checking that the coordinates did in fact change.
    expect(compare.equalArrays(start.x, finished.x)).toBe(false);
    expect(compare.equalArrays(start.y, finished.y)).toBe(false);

    // We get the same results when starting from existing NN results.
    let nnres2 = scran.findNearestNeighbors(index, 15);
    let finished2 = scran.runUmap(nnres2);
    expect(finished2.x).toEqual(finished.x);
    expect(finished2.y).toEqual(finished.y);

    // Cleaning up.
    index.free();
    init.free();
});

test("runUmap cloning as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    // Cloning.
    var init = scran.initializeUmap(index);
    var init2 = init.clone();
    var start = init2.extractCoordinates();

    init.run();
    var finished = init.extractCoordinates();
    expect(compare.equalArrays(start.x, finished.x)).toBe(false);
    expect(compare.equalArrays(start.y, finished.y)).toBe(false);

    // Clone is unaffected by processing.
    var start2 = init2.extractCoordinates();
    expect(compare.equalArrays(start2.x, start.x)).toBe(true);
    expect(compare.equalArrays(start2.y, start.y)).toBe(true);

    // Cleaning up.
    index.free();
    init.free();
    init2.free();
});

test("runUmap restarts work as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);
    var finished = scran.runUmap(index, { epochs: 500 });

    // Truncated run.
    var init = scran.initializeUmap(index, { epochs: 500 });
    init.run({ runTime: 1 });
    var halfway = init.extractCoordinates();
    expect(init.currentEpoch() < 500).toBe(true);
    expect(compare.equalArrays(halfway.x, finished.x)).toBe(false);
    expect(compare.equalArrays(halfway.y, finished.y)).toBe(false);

    // Completed run.
    init.run();
    var full = init.extractCoordinates();
    expect(init.currentEpoch()).toBe(500);
    expect(compare.equalArrays(full.x, finished.x)).toBe(true);
    expect(compare.equalArrays(full.y, finished.y)).toBe(true);

    // Cleaning up.
    index.free();
    init.free();
});
