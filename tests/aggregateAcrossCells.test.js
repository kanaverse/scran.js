import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("aggregation works as expected", () => {
    var ngenes = 1000;
    var ncells = 100;

    var mat = simulate.simulateMatrix(ngenes, ncells);

    var groups = [];
    for (var i = 0; i < ncells; i++) {
        groups.push(i % 3);
    }

    // Some cursory tests.
    var res = scran.aggregateAcrossCells(mat, groups);
    expect(res.numberOfGroups()).toBe(3);
    expect(res.numberOfGenes()).toBe(ngenes);

    // Comparing to the reference.
    for (var g = 0; g < 3; g++) {
        let obs = res.groupSums(g);
        expect(obs.length).toEqual(ngenes);

        let ref = new Float64Array(ngenes);
        for (var i = 0; i < ncells; i++) {
            if (groups[i] !== g) {
                continue;
            }

            let curcol = mat.column(i);
            for (var j = 0; j < ngenes; j++) {
                ref[j] += curcol[j];
            }
        }

        expect(obs.array()).toEqual(ref);
    }

    let agmat = res.allSums();
    expect(agmat.numberOfColumns()).toBe(3);
    expect(agmat.numberOfRows()).toBe(ngenes);
    expect(agmat.column(2)).toEqual(res.groupSums(2). slice());
    agmat.free();

    expect(res.allDetected({ asMatrix: false }).length).toEqual(ngenes * 3);

    // Works with averages.
    {
        var ares = scran.aggregateAcrossCells(mat, groups, { average: true });

        var groupsize = new Int32Array(3);
        for (var i = 0; i < ncells; i++) {
            groupsize[i % 3]++;
        }

        for (var g = 0; g < 3; g++) {
            let obs = res.groupSums(g).slice();
            for (var j = 0; j < ngenes; j++) {
                obs[j] /= groupsize[g];
            }

            let ref = ares.groupSums(g);
            expect(ref.array()).toEqual(obs);
        }

        ares.free();
    }

    // Cleaning up.
    mat.free();
    res.free();
});
