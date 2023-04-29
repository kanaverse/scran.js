import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";
import * as compare from "./compare.js";
import * as pako from "pako";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

function mockReferenceData(nlabels, nperlabel, nfeatures, nmarkers) {
    const converter = new TextEncoder();

    let markers_lines = "";
    for (var i = 0; i < nlabels; i++) {
        for (var j = 0; j < nlabels; j++) {
            if (i == j) {
                continue;
            }

            let markers = new Set();
            for (var m = 0; m < nmarkers; m++) {
                markers.add(Math.floor(Math.random() * nfeatures));
            }
            markers_lines += i + "\t" + j + "\t" + Array.from(markers).join("\t") + "\n";
        }
    }
    let markers_buffer = pako.gzip(converter.encode(markers_lines));

    let labels = [];
    for (var i = 0; i < nlabels; i++) {
        for (var j = 0; j < nperlabel; j++) {
            labels.push(i);
        }
    }
    let labels_lines = labels.join("\n");
    let labels_buffer = pako.gzip(converter.encode(labels_lines));

    let ranks_lines = "";
    for (var i = 0; i < nlabels * nperlabel; i++) {
        let stat = [];
        let index = [];
        for (var f = 0; f < nfeatures; f++) {
            stat.push(Math.random());
            index.push(f);
        }
        index.sort((a, b) => stat[a] - stat[b]);
        ranks_lines += Array.from(index).join(",") + "\n";
    }
    let ranks_buffer = pako.gzip(converter.encode(ranks_lines));

    return {
        "ranks": new Uint8Array(ranks_buffer),
        "labels": new Uint8Array(labels_buffer),
        "markers": new Uint8Array(markers_buffer)
    };
};

function mockIDs(nfeatures) {
    var mockids = new Array(nfeatures);
    for (var i = 0; i < nfeatures; i++) {
        mockids[i] = i;
    }
    return mockids;
}

const nlabels = 5;
const profiles_per_label = 10;
const nfeatures = 1000;

test("labelCells works correctly", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);
    expect(refinfo.numberOfLabels()).toBe(nlabels);
    expect(refinfo.numberOfSamples()).toBe(nlabels * profiles_per_label);
    expect(refinfo.numberOfFeatures()).toBe(nfeatures);

    // The simple case, no intersections.
    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);

    let built = scran.buildLabelledReference(mockids, refinfo, mockids);
    expect(built.sharedFeatures() > 0).toBe(true);

    let results = scran.labelCells(mat, built);
    expect(results.numberOfCells()).toBe(20);
    expect(results.numberOfLabels()).toBe(nlabels);
    expect(results.fineTuningDelta().length).toBe(20);
    expect(results.predictedLabels().length).toBe(20);
    expect(results.scoresForCell(1).length).toBe(nlabels);
    expect(results.scoresForLabel(3).length).toBe(20);

    let min = Infinity, max = -1;
    results.predictedLabels({ copy: false }).forEach(x => {
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

test("labelCells works correctly with shuffling", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);
    let built = scran.buildLabelledReference(mockids, refinfo, mockids);
    let results = scran.labelCells(mat, built); 

    // Shuffling the input order.
    var inter = [];
    for (var i = 0; i < nfeatures; i++) {
        inter.push("Gene" + i);
    }

    var stat = inter.map(x => Math.random()); // shuffling
    var indices = inter.map((x, i) => i);
    indices.sort((a, b) => stat[a] - stat[b]);
    var inter2 = indices.map(i => inter[i]);

    let built2 = scran.buildLabelledReference(inter, refinfo, inter2);
    let results2 = scran.labelCells(mat, built2);
    let labels2 = results2.predictedLabels();
    expect(compare.equalArrays(results.predictedLabels({ copy: false }), labels2)).toBe(false); // There should be some difference!

    // Shuffling the input matrix so that the features now match.
    {
        let built3 = scran.buildLabelledReference(inter2, refinfo, inter2);
        let sub = scran.subsetRows(mat, indices);
        let results3 = scran.labelCells(sub, built3);
        expect(compare.equalArrays(results3.predictedLabels({ copy: false }), labels2)).toBe(true);

        sub.free();
        built3.free();
        results3.free();
    }

    // Freeing the objects.
    refinfo.free();
    mat.free();
    built.free();
    built2.free();
    results.free();
    results2.free();
});

test("labelCells works correctly with intersections", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);
    let built = scran.buildLabelledReference(mockids, refinfo, mockids);
    let results = scran.labelCells(mat, built); 

    // Renaming the back half.
    let start = nfeatures / 2;
    let copy = mockids.slice();
    for (var i = start; i < nfeatures; i++) {
        copy[i] += "_____";
    }

    let built2 = scran.buildLabelledReference(copy, refinfo, mockids);
    let results2 = scran.labelCells(mat, built2);
    let labels2 = results2.predictedLabels();
    expect(compare.equalArrays(results.predictedLabels({ copy: false }), labels2)).toBe(false); // There should be some difference!

    // Subsetting the input matrix to remove non-matching features.
    {
        let built3 = scran.buildLabelledReference(copy.slice(0, start), refinfo, mockids);
        let feat = new Int32Array(start);
        feat.forEach((x, i) => feat[i] = i);
        let sub = scran.subsetRows(mat, feat);
        let results3 = scran.labelCells(sub, built3);
        expect(compare.equalArrays(results3.predictedLabels({ copy: false }), labels2)).toBe(true);

        sub.free();
        built3.free();
        results3.free();
    }

    // Freeing the objects.
    refinfo.free();
    mat.free();
    built.free();
    built2.free();
    results.free();
    results2.free();
});

test("labelCells ignores nulls correctly", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);
    let refbuilt = scran.buildLabelledReference(mockids, refinfo, mockids);
    let refresults = scran.labelCells(mat, refbuilt); 

    // Injecting nulls in half the features - there should be some effect!
    let copy = mockids.slice();
    let until = Math.round(nfeatures/2);
    for (var i = 0; i < until; i++) {
        copy[i] = null;
    }
    let built = scran.buildLabelledReference(copy, refinfo, mockids);
    expect(built.sharedFeatures() > 0).toBe(true);
    let results = scran.labelCells(mat, built); 
    let labels = results.predictedLabels();
    expect(compare.equalArrays(labels, refresults.predictedLabels({ copy: false }))).toBe(false);

    // Manually removing the first gene from the test matrix.
    {
        let built2 = scran.buildLabelledReference(mockids.slice(until), refinfo, mockids);
        let feat = new Int32Array(nfeatures-until);
        feat.forEach((x, i) => feat[i] = until + i);
        let sub = scran.subsetRows(mat, feat);
        let results2 = scran.labelCells(sub, built2); 
        expect(compare.equalArrays(labels, results2.predictedLabels({ copy: false }))).toBe(true);

        built2.free();
        sub.free();
        results2.free();
    }

    // null is also ignored in the reference features.
    {
        let built2 = scran.buildLabelledReference(copy, refinfo, mockids);
        let results2 = scran.labelCells(mat, built2); 
        expect(compare.equalArrays(labels, results2.predictedLabels({ copy: false }))).toBe(true);

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

test("labelCells works correctly with a dense matrix", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mockids = mockIDs(nfeatures);
    let built = scran.buildLabelledReference(mockids, refinfo, mockids);
    expect(built.sharedFeatures() > 0).toBe(true);

    // Sparse reference.
    let mat = simulate.simulateMatrix(nfeatures, 30);
    let results = scran.labelCells(mat, built); 

    // Densifying it.
    let buffer = scran.createFloat64WasmArray(nfeatures * 30);
    for (var i = 0; i < 30; i++) {
        buffer.set(mat.column(i), i * nfeatures);
    }

    let results2 = scran.labelCells(buffer, built, { numberOfFeatures: nfeatures, numberOfCells: 30 }); 
    expect(compare.equalArrays(results.predictedLabels({ copy: false }), results.predictedLabels({ copy: false }))).toBe(true);

    // Freeing the objects.
    refinfo.free();
    mat.free();
    built.free();
    buffer.free();
    results.free();
    results2.free();
});

test("multi-reference integration works correctly", () => {
    let mockids = mockIDs(nfeatures);
    let test = simulate.simulateMatrix(nfeatures, 30);

    let refA = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfoA = scran.loadLabelledReferenceFromBuffers(refA.ranks, refA.markers, refA.labels);
    let idsA = mockids.map(x => (Math.random() < 0.3 ? x : -1));
    let builtA = scran.buildLabelledReference(mockids, refinfoA, idsA);

    let refB = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfoB = scran.loadLabelledReferenceFromBuffers(refB.ranks, refB.markers, refB.labels);
    let idsB = mockids.map(x => (Math.random() < 0.3 ? x : -1));
    let builtB = scran.buildLabelledReference(mockids, refinfoB, idsB);

    // Building the integrated reference.
    let inter = scran.integrateLabelledReferences(mockids, [refinfoA, refinfoB], [idsA, idsB], [builtA, builtB]);
    expect(inter.numberOfReferences()).toBe(2);

    // Using the various objects for classification of the test matrix.
    // Not much checks we can do here other than to verify that the ints are wihtin range.
    let resA =  scran.labelCells(test, builtA);
    let resB = scran.labelCells(test, builtB);
    let labB = resB.predictedLabels();
    resB.free();

    let combined = scran.integrateCellLabels(test, [resA, labB], inter);
    expect(combined.numberOfCells()).toBe(test.numberOfColumns());
    expect(combined.numberOfReferences()).toBe(2);
    expect(combined.fineTuningDelta().length).toBe(test.numberOfColumns());
    expect(combined.predictedReferences().length).toBe(test.numberOfColumns());
    expect(combined.scoresForCell(0).length).toBe(2);
    expect(combined.scoresForReference(1).length).toBe(test.numberOfColumns());

    let min = 1000;
    let max = -1;
    combined.predictedReferences({ copy: false }).forEach(x => {
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

