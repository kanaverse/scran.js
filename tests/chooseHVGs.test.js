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
