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

    let payload = res.allSums();
    let agmat = scran.ScranMatrix.createDenseMatrix(res.numberOfGenes(), res.numberOfGroups(), payload);
    expect(agmat.numberOfColumns()).toBe(3);
    expect(agmat.numberOfRows()).toBe(ngenes);
    payload.free();

    payload = res.allDetected();
    let dagmat = scran.ScranMatrix.createDenseMatrix(res.numberOfGenes(), res.numberOfGroups(), payload);
    expect(dagmat.numberOfColumns()).toBe(3);
    expect(dagmat.numberOfRows()).toBe(ngenes);
    payload.free();

    // Comparing to the reference.
    for (var g = 0; g < 3; g++) {
        let obs = res.groupSums(g);
        expect(obs.length).toEqual(ngenes);
        let dobs = res.groupDetected(g);
        expect(dobs.length).toEqual(ngenes);

        let ref = new Float64Array(ngenes);
        let dref = new Float64Array(ngenes);
        for (var i = 0; i < ncells; i++) {
            if (groups[i] !== g) {
                continue;
            }

            let curcol = mat.column(i);
            for (var j = 0; j < ngenes; j++) {
                ref[j] += curcol[j];
                dref[j] += (curcol[j] != 0);
            }
        }

        expect(obs).toEqual(ref);
        expect(dobs).toEqual(dref);
        expect(agmat.column(g)).toEqual(ref);
        expect(dagmat.column(g)).toEqual(dref);
    }

    agmat.free();
    dagmat.free();

    // Works with averages.
    {
        var ares = scran.aggregateAcrossCells(mat, groups, { average: true });

        var groupsize = new Int32Array(3);
        for (var i = 0; i < ncells; i++) {
            groupsize[i % 3]++;
        }

        for (var g = 0; g < 3; g++) {
            let obs = res.groupSums(g);
            for (var j = 0; j < ngenes; j++) {
                obs[j] /= groupsize[g];
            }
            expect(compare.equalFloatArrays(ares.groupSums(g), obs)).toBe(true);
        }

        ares.free();
    }

    // Cleaning up.
    mat.free();
    res.free();
});
