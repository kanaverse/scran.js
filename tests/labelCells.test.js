import * as scran from "../js/index.js";
import { intersectFeatures } from "../js/labelCells.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as pako from "pako";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

function simulateReferenceData(nlabels, nperlabel, nfeatures, nmarkers) {
    let output = {};

    let all_markers = [];
    for (var i = 0; i < nlabels; i++) {
        let inner_markers = [];
        for (var j = 0; j < nlabels; j++) {
            if (i == j) {
                inner_markers.push(null);
            } else {
                let cur_markers = new Set();
                for (var m = 0; m < nmarkers; m++) {
                    cur_markers.add(Math.floor(Math.random() * nfeatures));
                }
                inner_markers.push(Array.from(cur_markers));
            }
        }
        all_markers.push(inner_markers);
    }

    let labels = [];
    for (var i = 0; i < nlabels; i++) {
        for (var j = 0; j < nperlabel; j++) {
            labels.push(i);
        }
    }

    let rankings = [];
    for (var i = 0; i < nlabels * nperlabel; i++) {
        let stat = [];
        let index = [];
        for (var f = 0; f < nfeatures; f++) {
            stat.push(Math.random());
            index.push(f);
        }
        index.sort((a, b) => stat[a] - stat[b]);
        rankings.push(Array.from(index));
    }

    return { 
        markers: all_markers,
        labels: labels,
        rankings: rankings
    };
}

function writeReferenceData(simulated) {
    const converter = new TextEncoder();

    let markers_lines = "";
    for (var i = 0; i < simulated.markers.length; i++) {
        const outer = simulated.markers[i];
        for (var j = 0; j < outer.length; j++) {
            const inner = outer[j];
            if (inner !== null) {
                markers_lines += i + "\t" + j + "\t" + inner.join("\t") + "\n";
            }
        }
    }
    let markers_buffer = pako.gzip(converter.encode(markers_lines));

    let labels_lines = simulated.labels.join("\n");
    let labels_buffer = pako.gzip(converter.encode(labels_lines));

    let ranks_lines = "";
    for (const rank of simulated.rankings) {
        ranks_lines += rank.join(",") + "\n";
    }
    let ranks_buffer = pako.gzip(converter.encode(ranks_lines));

    return {
        "ranks": new Uint8Array(ranks_buffer),
        "labels": new Uint8Array(labels_buffer),
        "markers": new Uint8Array(markers_buffer)
    };
};

function subsetReferenceData(simulated, subset) {
    let mapping = new Map;
    for (var i = 0; i < subset.length; i++) {
        mapping.set(subset[i], i);
    }

    let new_markers = [];
    for (var i = 0; i < simulated.markers.length; i++) {
        const outer = simulated.markers[i];
        let new_outer = [];
        for (var j = 0; j < outer.length; j++) {
            const inner = outer[j];
            if (inner !== null) {
                let cur_markers = [];
                for (const x of inner) {
                    if (mapping.has(x)) {
                        cur_markers.push(mapping.get(x));
                    }
                }
                new_outer.push(cur_markers);
            } else {
                new_outer.push(null);
            }
        }
        new_markers.push(new_outer);
    }

    let new_rankings = [];
    for (const rank of simulated.rankings) {
        let new_rank = subset.map(x => rank[x]);
        new_rankings.push(new_rank);
    }

    let output = { ...simulated };
    output.markers = new_markers;
    output.rankings = new_rankings;
    return output;
}

function mockReferenceData(nlabels, nperlabel, nfeatures, nmarkers) {
    const simulated = simulateReferenceData(nlabels, nperlabel, nfeatures, nmarkers);
    return writeReferenceData(simulated);
}

function mockIDs(nfeatures) {
    var mockids = new Array(nfeatures);
    for (var i = 0; i < nfeatures; i++) {
        mockids[i] = i;
    }
    return mockids;
}

function pickRandom(nfeatures, prob) {
    let test_keep = [];
    for (var i = 0; i < nfeatures; i++) {
        const r = Math.random();
        if (r <= prob) {
            test_keep.push([ r, i ]);
        }
    }
    test_keep.sort((a, b) => a[0] - b[0]);
    return test_keep.map(x => x[1]);
}

function maskUnpickedIds(ids, chosen, mask) {
    let is_chosen = new Set(chosen);
    let copy = ids.slice();
    for (var i = 0; i < copy.length; i++) {
        if (!is_chosen.has(copy[i])) {
            copy[i] += mask;
        }
    }
    return copy;
}

const nlabels = 5;
const profiles_per_label = 10;
const nfeatures = 1000;

test("labelCells works correctly", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelCellsReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);
    expect(refinfo.numberOfLabels()).toBe(nlabels);
    expect(refinfo.numberOfSamples()).toBe(nlabels * profiles_per_label);
    expect(refinfo.numberOfFeatures()).toBe(nfeatures);

    // The simple case, no intersections.
    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);

    let built = scran.trainLabelCellsReference(mockids, refinfo, mockids);
    expect(built.numberOfFeatures() > 0).toBe(true);

    let results = scran.labelCells(mat, built);
    expect(results.numberOfCells()).toBe(20);
    expect(results.numberOfLabels()).toBe(nlabels);
    expect(results.delta().length).toBe(20);
    expect(results.predicted().length).toBe(20);
    expect(results.scoreForCell(1).length).toBe(nlabels);
    expect(results.scoreForLabel(3).length).toBe(20);

    let min = Infinity, max = -1;
    results.predicted({ copy: false }).forEach(x => {
        if (x < min) { min = x; }
        if (x > max) { max = x; }
    });
    expect(min >= 0).toBe(true);
    expect(max < 5).toBe(true);

    // Freeing the objects.
    refinfo.free();
    built.free();
    results.free();
    mat.free();
})

test("labelCells works correctly with intersections", () => {
    let simulated = simulateReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let ref = writeReferenceData(simulated);
    let refinfo = scran.loadLabelCellsReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);
    let built = scran.trainLabelCellsReference(mockids, refinfo, mockids);
    let results = scran.labelCells(mat, built); 

    // Randomly selecting some for the test and some for the training set.
    let ref_keep = pickRandom(nfeatures, 0.7);
    let subref = writeReferenceData(subsetReferenceData(simulated, ref_keep));
    let subrefinfo = scran.loadLabelCellsReferenceFromBuffers(subref.ranks, subref.markers, subref.labels);
    let subrefids = ref_keep.map(x => mockids[x]);

    let test_keep = pickRandom(nfeatures, 0.7);
    let testids = maskUnpickedIds(mockids, test_keep, "----");

    let built2 = scran.trainLabelCellsReference(testids, subrefinfo, subrefids);
    let results2 = scran.labelCells(mat, built2);
    let labels2 = results2.predicted();
    expect(compare.equalArrays(results.predicted({ copy: false }), labels2)).toBe(false); // There should be some difference!
    let firstscore2 = results2.scoreForCell(0);
    expect(compare.equalFloatArrays(results.scoreForCell(0), firstscore2)).toBe(false); // There should be some difference!

    // Manually subsetting the input matrix to the intersection.
    {
        const intersection = intersectFeatures(test_keep, ref_keep);
        let inter_test = intersection.test.map(x => test_keep[x]);
        let inter_ref = intersection.reference.map(x => ref_keep[x]);

        let testids = inter_test.map(x => mockids[x]);
        let subrefids = inter_ref.map(x => mockids[x]);
        expect(testids).toEqual(subrefids);

        let subref = writeReferenceData(subsetReferenceData(simulated, inter_ref));
        let subrefinfo = scran.loadLabelCellsReferenceFromBuffers(subref.ranks, subref.markers, subref.labels);
        let built3 = scran.trainLabelCellsReference(testids, subrefinfo, subrefids);

        let sub = scran.subsetRows(mat, inter_test);
        let results3 = scran.labelCells(sub, built3);
        expect(compare.equalArrays(results3.predicted({ copy: false }), labels2)).toBe(true);
        expect(compare.equalFloatArrays(results3.scoreForCell(0), firstscore2)).toBe(true);

        sub.free();
        subrefinfo.free();
        built3.free();
        results3.free();
    }

    // Freeing the objects.
    refinfo.free();
    mat.free();
    built.free();
    subrefinfo.free();
    built2.free();
    results.free();
    results2.free();
});

test("labelCells ignores nulls correctly", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelCellsReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);
    let refbuilt = scran.trainLabelCellsReference(mockids, refinfo, mockids);
    let refresults = scran.labelCells(mat, refbuilt); 

    // Injecting nulls in half the features - there should be some effect!
    let copy = mockids.slice();
    let until = Math.round(nfeatures/2);
    for (var i = 0; i < until; i++) {
        copy[i] = null;
    }
    let built = scran.trainLabelCellsReference(copy, refinfo, mockids);
    expect(built.numberOfFeatures() > 0).toBe(true);
    let results = scran.labelCells(mat, built); 
    let labels = results.predicted();
    expect(compare.equalArrays(labels, refresults.predicted({ copy: false }))).toBe(false);
    let firstscore = results.scoreForCell(0, { copy: false });

    // Manually removing the first gene from the test matrix.
    {
        let built2 = scran.trainLabelCellsReference(mockids.slice(until), refinfo, mockids);
        let feat = new Int32Array(nfeatures-until);
        feat.forEach((x, i) => feat[i] = until + i);
        let sub = scran.subsetRows(mat, feat);
        let results2 = scran.labelCells(sub, built2); 
        expect(compare.equalArrays(labels, results2.predicted({ copy: false }))).toBe(true);
        expect(compare.equalFloatArrays(firstscore, results2.scoreForCell(0))).toBe(true);

        built2.free();
        sub.free();
        results2.free();
    }

    // null is also ignored in the reference features.
    {
        let built2 = scran.trainLabelCellsReference(copy, refinfo, mockids);
        let results2 = scran.labelCells(mat, built2); 
        expect(compare.equalArrays(labels, results2.predicted({ copy: false }))).toBe(true);
        expect(compare.equalFloatArrays(firstscore, results2.scoreForCell(0))).toBe(true);

        built2.free();
        results2.free();
    }

    // Freeing the objects.
    refinfo.free();
    mat.free();
    built.free();
    results.free();
    refresults.free();
});

test("labelCells handles synonyms correctly", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let info = scran.loadLabelCellsReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);
    let built = scran.trainLabelCellsReference(mockids, info, mockids);
    let results = scran.labelCells(mat, built); 
    let labels = results.predicted();
    let firstscore = results.scoreForCell(0);

    // Synonyms in the reference.
    {
        let refids = mockids.slice();
        let dataids = mockids.slice();
        refids[0] = [ "A", "B" ];
        dataids[0] = "B";

        let built2 = scran.trainLabelCellsReference(dataids, info, refids);
        let results2 = scran.labelCells(mat, built2); 
        expect(compare.equalArrays(labels, results2.predicted({ copy: false }))).toBe(true);
        expect(compare.equalFloatArrays(firstscore, results2.scoreForCell(0))).toBe(true);

        built2.free();
        results2.free();
    }

    // First matching synonym wins.
    {
        let refids = mockids.slice();
        let dataids = mockids.slice();
        dataids[0] = "A";
        dataids[1] = "B";
        refids[0] = ["A", "B"];
        refids[1] = ["C", "B"]; 

        let built2 = scran.trainLabelCellsReference(dataids, info, refids);
        let results2 = scran.labelCells(mat, built2); 
        expect(compare.equalArrays(labels, results2.predicted({ copy: false }))).toBe(true);
        expect(compare.equalFloatArrays(firstscore, results2.scoreForCell(0))).toBe(true);

        built2.free();
        results2.free();
    }

    // Freeing the objects.
    info.free();
    mat.free();
    built.free();
    results.free();
});

test("labelCells ignores duplicated feature IDs", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelCellsReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);
    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);

    // Duplicates in the reference.
    {
        let refids = mockids.slice();
        let dataids = mockids.slice();

        refids[1] = refids[0];
        let built = scran.trainLabelCellsReference(dataids, refinfo, refids);
        let results = scran.labelCells(mat, built); 

        // Gives the same output as if the duplicate was unmatchable.
        refids[1] = "FOOBAR";
        let built2 = scran.trainLabelCellsReference(dataids, refinfo, refids);
        let results2 = scran.labelCells(mat, built2); 
        expect(compare.equalArrays(results.predicted({ copy: false }), results2.predicted({ copy: false }))).toBe(true);
        expect(compare.equalFloatArrays(results.scoreForCell(0), results2.scoreForCell(0))).toBe(true);

        built.free();
        results.free();
        built2.free();
        results2.free();
    }

    // Duplicates in the data IDs.
    {
        let refids = mockids.slice();
        let dataids = mockids.slice();

        dataids[1] = dataids[0];
        let built = scran.trainLabelCellsReference(dataids, refinfo, refids);
        let results = scran.labelCells(mat, built); 

        // Gives the same output as if the duplicate was unmatchable.
        dataids[1] = "FOOBAR";
        let built2 = scran.trainLabelCellsReference(dataids, refinfo, refids);
        let results2 = scran.labelCells(mat, built2); 
        expect(compare.equalArrays(results.predicted({copy: false}), results2.predicted({ copy: false }))).toBe(true);
        expect(compare.equalFloatArrays(results.scoreForCell(0), results2.scoreForCell(0))).toBe(true);

        built.free();
        results.free();
        built2.free();
        results2.free();
    }

    mat.free();
    refinfo.free();
})

test("labelCells works correctly with a dense matrix", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelCellsReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mockids = mockIDs(nfeatures);
    let built = scran.trainLabelCellsReference(mockids, refinfo, mockids);
    expect(built.numberOfFeatures() > 0).toBe(true);

    // Sparse reference.
    let mat = simulate.simulateMatrix(nfeatures, 30);
    let results = scran.labelCells(mat, built); 

    // Densifying it.
    let buffer = scran.createFloat64WasmArray(nfeatures * 30);
    for (var i = 0; i < 30; i++) {
        buffer.set(mat.column(i), i * nfeatures);
    }

    let results2 = scran.labelCells(buffer, built, { numberOfFeatures: nfeatures, numberOfCells: 30 }); 
    expect(compare.equalArrays(results.predicted({ copy: false }), results2.predicted({ copy: false }))).toBe(true);
    expect(compare.equalFloatArrays(results.scoreForCell(0), results2.scoreForCell(0))).toBe(true);

    // Freeing the objects.
    refinfo.free();
    mat.free();
    built.free();
    buffer.free();
    results.free();
    results2.free();
});

test("multi-reference integration works correctly with variable intersections", () => {
    let mockids = mockIDs(nfeatures);
    let test = simulate.simulateMatrix(nfeatures, 30);

    let refA = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfoA = scran.loadLabelCellsReferenceFromBuffers(refA.ranks, refA.markers, refA.labels);
    let idsA = mockids.map(x => (Math.random() < 0.3 ? x : -1));
    let builtA = scran.trainLabelCellsReference(mockids, refinfoA, idsA);

    let refB = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfoB = scran.loadLabelCellsReferenceFromBuffers(refB.ranks, refB.markers, refB.labels);
    let idsB = mockids.map(x => (Math.random() < 0.3 ? x : -1));
    let builtB = scran.trainLabelCellsReference(mockids, refinfoB, idsB);

    // Building the integrated reference.
    let inter = scran.integrateLabelCellsReferences(mockids, [refinfoA, refinfoB], [idsA, idsB], [builtA, builtB]);
    expect(inter.numberOfReferences()).toBe(2);

    // Using the various objects for classification of the test matrix.
    // Not much checks we can do here other than to verify that the ints are wihtin range.
    let resA =  scran.labelCells(test, builtA);
    let resB = scran.labelCells(test, builtB);
    let labB = resB.predicted();
    resB.free();

    let combined = scran.integrateLabelCells(test, [resA, labB], inter);
    expect(combined.numberOfCells()).toBe(test.numberOfColumns());
    expect(combined.numberOfReferences()).toBe(2);
    expect(combined.delta().length).toBe(test.numberOfColumns());
    expect(combined.predicted().length).toBe(test.numberOfColumns());
    expect(combined.scoreForCell(0).length).toBe(2);
    expect(combined.scoreForReference(1).length).toBe(test.numberOfColumns());

    let min = 1000;
    let max = -1;
    combined.predicted({ copy: false }).forEach(x => {
        if (x < min) {
            min = x;
        }
        if (x > max) {
            max = x;
        }
    });
    expect(min >= 0 && min <= 1).toBe(true);
    expect(max >= 0 && max <= 1).toBe(true);

    // Freeing all the bits and pieces.
    refinfoA.free();
    builtA.free();
    refinfoB.free();
    builtB.free();
    inter.free();
    resA.free();
});

test("multi-reference integration works correctly with consistent intersections", () => {
    let mockids = mockIDs(nfeatures);
    let test = simulate.simulateMatrix(nfeatures, 30);
    let test_keep = pickRandom(nfeatures, 0.6);
    let ref_keep = pickRandom(nfeatures, 0.6);
    let testids = maskUnpickedIds(mockids, test_keep, "----");
    let refids = maskUnpickedIds(mockids, ref_keep, "....");

    let rawA = simulateReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refA = writeReferenceData(rawA);
    let refinfoA = scran.loadLabelCellsReferenceFromBuffers(refA.ranks, refA.markers, refA.labels);
    let builtA = scran.trainLabelCellsReference(testids, refinfoA, refids);

    let rawB = simulateReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refB = writeReferenceData(rawB);
    let refinfoB = scran.loadLabelCellsReferenceFromBuffers(refB.ranks, refB.markers, refB.labels);
    let builtB = scran.trainLabelCellsReference(testids, refinfoB, refids);

    // Building the integrated reference.
    let inter = scran.integrateLabelCellsReferences(testids, [refinfoA, refinfoB], [refids, refids], [builtA, builtB]);
    expect(inter.numberOfReferences()).toBe(2);

    let resA =  scran.labelCells(test, builtA);
    let resB = scran.labelCells(test, builtB);
    let labA = resA.predicted();
    let labB = resB.predicted();

    let combined = scran.integrateLabelCells(test, [labA, labB], inter);

    // Comparing to a reference with everything pre-subsetted.
    {
        const intersection = intersectFeatures(test_keep, ref_keep);
        let inter_test = intersection.test.map(x => test_keep[x]);
        let inter_ref = intersection.reference.map(x => ref_keep[x]);

        let testids = inter_test.map(x => mockids[x]);
        let subrefids = inter_ref.map(x => mockids[x]);
        expect(testids).toEqual(subrefids);

        let subrefA = writeReferenceData(subsetReferenceData(rawA, inter_ref));
        let subrefinfoA = scran.loadLabelCellsReferenceFromBuffers(subrefA.ranks, subrefA.markers, subrefA.labels);
        let subbuiltA = scran.trainLabelCellsReference(testids, subrefinfoA, subrefids);

        let subrefB = writeReferenceData(subsetReferenceData(rawB, inter_ref));
        let subrefinfoB = scran.loadLabelCellsReferenceFromBuffers(subrefB.ranks, subrefB.markers, subrefB.labels);
        let subbuiltB = scran.trainLabelCellsReference(testids, subrefinfoB, subrefids);

        // Building the integrated reference.
        let subinter = scran.integrateLabelCellsReferences(testids, [subrefinfoA, subrefinfoB], [subrefids, subrefids], [subbuiltA, subbuiltB]);
        expect(inter.numberOfReferences()).toBe(2);

        let sub = scran.subsetRows(test, inter_test);
        let subresA =  scran.labelCells(sub, subbuiltA);
        let subresB = scran.labelCells(sub, subbuiltB);
        let sublabA = resA.predicted();
        let sublabB = resB.predicted();

        let subcombined = scran.integrateLabelCells(sub, [sublabA, sublabB], subinter);
        expect(subcombined.predicted()).toEqual(combined.predicted());
        expect(compare.equalFloatArrays(subcombined.delta(), combined.delta())).toBe(true);
        expect(compare.equalFloatArrays(subcombined.scoreForCell(0), combined.scoreForCell(0))).toBe(true);

        sub.free();
        subrefinfoA.free();
        subrefinfoB.free();
        subbuiltA.free();
        subbuiltB.free();
        subinter.free();
        subresA.free();
        subresB.free();
        subcombined.free();
    }

    // Freeing all the bits and pieces.
    refinfoA.free();
    builtA.free();
    refinfoB.free();
    builtB.free();
    inter.free();
    resA.free();
    resB.free();
});


test("intersection works as expected for edge cases", () => {
    let out = intersectFeatures(["A", "B", "C", "a"], ["A", "B", "C", "D", "E"]);
    expect(out.test).toEqual([0,1,2]);
    expect(out.reference).toEqual([0,1,2]);

    out = intersectFeatures(["a", "E", "b", "G", "c", "B", "d"], ["A", "B", "C", "D", "E", "F", "G"]);
    expect(out.test).toEqual([5,1,3]);
    expect(out.reference).toEqual([1,4,6]);

    out = intersectFeatures(["y", "y", "x", "z", null, "z", "x"], ["a", "b", "c", null, "x", "x", "y", "y", "z", "z"])
    expect(out.test).toEqual([2, 0, 3])
    expect(out.reference).toEqual([4, 6, 8]);

    out = intersectFeatures(["A", "a", "b", "B", "C", "c"], [["A", "a"], ["B", "b"], ["C", "c"]]);
    expect(out.test).toEqual([0, 3, 4])
    expect(out.reference).toEqual([0, 1, 2]);
})
