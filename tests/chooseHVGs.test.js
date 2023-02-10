import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("chooseHVGs works correctly", () => {
    var ngenes = 1000;
    var ncells = 100;

    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);
    var res = scran.modelGeneVar(norm);

    var output = scran.chooseHVGs(res, { number: 101 });
    expect(output.length).toBe(ngenes);
    expect(output.constructor.className).toBe("Uint8WasmArray");

    var total = 0;
    var min_selected = Infinity, max_unselected = -Infinity;
    var oarr = output.array();
    res.residuals().forEach((x, i) => {
        if (oarr[i]) {
            total++;
            min_selected = Math.min(min_selected, x);
        } else {
            max_unselected = Math.max(max_unselected, x);
        }
    });
    expect(total).toBe(101);
    expect(min_selected > max_unselected).toBe(true);

    // Cleaning up.
    mat.free();
    norm.free();
    res.free();
    output.free();
});

test("chooseHVGs avoids picking negative residuals", () => {
    let res = [ 0, 2, 3, 4, -1 ];
    var output = scran.chooseHVGs(res, { number: 101 });

    let expected = new Uint8Array(res.length);
    expected.fill(1);
    expected[4] = 0;
    expect(output.array()).toEqual(expected);

    let output2 = scran.chooseHVGs(res, { number: 101, minimum: -1 });
    expected[4] = 1;
    expect(output2.array()).toEqual(expected);

    // Cleaning up.
    output.free();
    output2.free();
})

test("computeTopThreshold works correctly", () => {
    expect(scran.computeTopThreshold([1,2,3,4,5], 1)).toEqual(5);
    expect(scran.computeTopThreshold([5,2,3,4,1], 2)).toEqual(4);
    expect(scran.computeTopThreshold([5,2,3,4,1], 100)).toEqual(1);
    expect(scran.computeTopThreshold([5,1,4,3,2], 1, { largest: false })).toEqual(1);
    expect(scran.computeTopThreshold([3,4,5,1,2], 2, { largest: false })).toEqual(2);
    expect(scran.computeTopThreshold([3,4,5,1,2], 200, { largest: false })).toEqual(5);

    // Same for typed arrays.
    expect(scran.computeTopThreshold(new Float64Array([5,2,1,4,3]), 1)).toEqual(5);
    expect(scran.computeTopThreshold(new Float64Array([3,2,5,4,1]), 2)).toEqual(4);
    expect(scran.computeTopThreshold(new Float64Array([2,1,3,4,5]), 1, { largest: false })).toEqual(1);
    expect(scran.computeTopThreshold(new Float64Array([4,3,2,5,1]), 2, { largest: false })).toEqual(2);

    expect(scran.computeTopThreshold([], 20)).toEqual(Number.NaN);
})

