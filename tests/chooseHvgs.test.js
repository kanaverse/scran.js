import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("chooseHvgs works correctly", () => {
    var ngenes = 1000;
    var ncells = 100;

    var mat = simulate.simulateMatrix(ngenes, ncells);
    var norm = scran.logNormCounts(mat);
    var res = scran.modelGeneVariances(norm);

    var output = scran.chooseHvgs(res, { number: 101 });
    expect(output.length).toBe(ngenes);
    expect(output.constructor.name).toBe("Uint8Array");

    var total = 0;
    var min_selected = Infinity, max_unselected = -Infinity;
    res.residuals().forEach((x, i) => {
        if (output[i]) {
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
});

test("chooseHvgs avoids picking zero or negative residuals", () => {
    let res = [ 0, 2, 3, 4, -1 ];
    var output = scran.chooseHvgs(res, { number: 101 });

    let expected = new Uint8Array(res.length);
    expected.fill(1);
    expected[0] = 0;
    expected[4] = 0;
    expect(output).toEqual(expected);

    let output2 = scran.chooseHvgs(res, { number: 101, minimum: -1 });
    expected[0] = 1;
    expect(output2).toEqual(expected);
})
