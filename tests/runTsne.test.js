import * as scran from "../js/index.js";
import * as compare from "./compare.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("runTsne works as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    // Initializing and running the algorithm.
    var init = scran.initializeTSNE(index);
    var start = init.extractCoordinates();
    expect(init.iterations()).toBe(0);
    expect(init.numberOfCells()).toBe(ncells);

    scran.runTsne(init, { maxIterations: 1000 });
    var finished = init.extractCoordinates();
    expect(init.iterations()).toBe(1000);

    // Checking that the coordinates did in fact change.
    expect(compare.equalArrays(start.x, finished.x)).toBe(false);
    expect(compare.equalArrays(start.y, finished.y)).toBe(false);

    // Cleaning up.
    index.free();
    init.free();
});

test("runTsne cloning as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    // Cloning.
    var init = scran.initializeTSNE(index);
    var init2 = init.clone();
    var start = init2.extractCoordinates();

    scran.runTsne(init);
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

test("runTsne restarts work as expected", () => {
    var ndim = 5;
    var ncells = 100;
    var index = simulate.simulateIndex(ndim, ncells);

    // Full run.
    var init = scran.initializeTSNE(index);
    var init2 = init.clone();
    scran.runTsne(init, { maxIterations: 1000 });
    var finished = init.extractCoordinates();

    // Half run.
    scran.runTsne(init2, { maxIterations: 100 });
    var halfway = init2.extractCoordinates();
    expect(init2.iterations()).toBe(100);
    expect(compare.equalArrays(halfway.x, finished.x)).toBe(false);
    expect(compare.equalArrays(halfway.y, finished.y)).toBe(false);

    // Completed run.
    scran.runTsne(init2, { maxIterations: 1000 });
    var full = init2.extractCoordinates();
    expect(init2.iterations()).toBe(1000);
    expect(compare.equalArrays(full.x, finished.x)).toBe(true);
    expect(compare.equalArrays(full.y, finished.y)).toBe(true);

    // Cleaning up.
    index.free();
    init.free();
    init2.free();
});
