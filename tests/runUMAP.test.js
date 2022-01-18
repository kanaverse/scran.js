import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize() });
afterAll(async () => { await scran.terminate() });

test("runUMAP works as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    // Initializing and running the algorithm.
    var init = scran.initializeUMAP(index, { epochs: 500 });
    var start = init.extractCoordinates();
    expect(init.currentEpoch()).toBe(0);
    expect(init.numberOfCells()).toBe(ncells);

    scran.runUMAP(init);
    var finished = init.extractCoordinates();
    expect(init.currentEpoch()).toBe(500);

    // Checking that the coordinates did in fact change.
    expect(compare.equalArrays(start.x, finished.x)).toBe(false);
    expect(compare.equalArrays(start.y, finished.y)).toBe(false);

    // Cleaning up.
    index.free();
    init.free();
});

test("runUMAP cloning as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    // Cloning.
    var init = scran.initializeUMAP(index);
    var init2 = init.clone();
    var start = init2.extractCoordinates();

    scran.runUMAP(init);
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

test("runUMAP restarts work as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    // Full run.
    var init = scran.initializeUMAP(index, { epochs: 500 });
    var init2 = init.clone();
    scran.runUMAP(init);
    var finished = init.extractCoordinates();

    // Truncated run.
    scran.runUMAP(init2, { runTime: 1 });
    var halfway = init2.extractCoordinates();
    expect(init2.currentEpoch() < 500).toBe(true);
    expect(compare.equalArrays(halfway.x, finished.x)).toBe(false);
    expect(compare.equalArrays(halfway.y, finished.y)).toBe(false);

    // Completed run.
    scran.runUMAP(init2);
    var full = init2.extractCoordinates();
    expect(init2.currentEpoch()).toBe(500);
    expect(compare.equalArrays(full.x, finished.x)).toBe(true);
    expect(compare.equalArrays(full.y, finished.y)).toBe(true);

    // Cleaning up.
    index.free();
    init.free();
    init2.free();
});
