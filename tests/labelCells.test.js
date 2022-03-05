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

    let labels = scran.labelCells(mat, built);
    expect(labels.length).toBe(20);

    let min = Infinity, max = -1;
    labels.forEach(x => {
        if (x < min) { min = x; }
        if (x > max) { max = x; }
    });
    expect(min >= 0).toBe(true);
    expect(max < 5).toBe(true);

    // Works with a buffer.
    let buf = scran.createInt32WasmArray(20);
    let labels2 = scran.labelCells(mat, built, { buffer: buf });
    expect(compare.equalArrays(labels, labels2)).toBe(true);

    // Freeing the objects.
    refinfo.free();
    built.free();
    mat.free();
})

test("labelCells works correctly with intersections", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mat = simulate.simulateMatrix(nfeatures, 20);
    let mockids = mockIDs(nfeatures);

    // No intersection reference.
    let built = scran.buildLabelledReference(mockids, refinfo, mockids);
    expect(built.sharedFeatures() > 0).toBe(true);
    let labels = scran.labelCells(mat, built); 

    // Throwing in some intersections.
    var inter = [];
    for (var i = 0; i < nfeatures; i++) {
        inter.push("Gene" + i);
    }

    var stat = inter.map(x => Math.random()); // shuffling
    var indices = inter.map((x, i) => i);
    indices.sort((a, b) => stat[a] - stat[b]);
    var inter2 = indices.map(i => inter[i]);

    let built2 = scran.buildLabelledReference(inter, refinfo, inter2);
    let labels2 = scran.labelCells(mat, built2);

    // There should be some difference!
    expect(compare.equalArrays(labels, labels2)).toBe(false);

    // Freeing the objects.
    refinfo.free();
    mat.free();
    built.free();
    built2.free();
});

test("labelCells works correctly with a dense matrix", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mockids = mockIDs(nfeatures);
    let built = scran.buildLabelledReference(mockids, refinfo, mockids);
    expect(built.sharedFeatures() > 0).toBe(true);

    // Sparse reference.
    let mat = simulate.simulateMatrix(nfeatures, 30);
    let labels = scran.labelCells(mat, built); 

    // Densifying it.
    let buffer = scran.createFloat64WasmArray(nfeatures * 30);
    for (var i = 0; i < 30; i++) {
        buffer.set(mat.column(i), i * nfeatures);
    }

    let labels2 = scran.labelCells(buffer, built, { numberOfFeatures: nfeatures, numberOfCells: 30 }); 
    expect(compare.equalArrays(labels, labels2)).toBe(true);

    // Freeing the objects.
    refinfo.free();
    mat.free();
    built.free();
    buffer.free();
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
    let labA = scran.createInt32WasmArray(test.numberOfColumns());
    scran.labelCells(test, builtA, { buffer: labA });
    let labB = scran.labelCells(test, builtB);

    let combined = scran.integrateCellLabels(test, [labA, labB], inter);
    let min = 1000;
    let max = -1;
    combined.forEach(x => {
        if (x < min) {
            min = x;
        }
        if (x > max) {
            max = x;
        }
    });
    expect(min >= 0 && min <= 1).toBe(true);
    expect(max >= 0 && max <= 1).toBe(true);
    expect(combined.length).toBe(test.numberOfColumns());

    // Freeing all the bits and pieces.
    refinfoA.free();
    builtA.free();
    refinfoB.free();
    builtB.free();
    inter.free();
    labA.free();
});

