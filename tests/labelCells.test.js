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
    let output = scran.labelCells(mat, refinfo);
    expect(output.usedMarkers > 0).toBe(true);
    let labels = output.labels;
    expect(labels.length).toBe(20);

    let min = Infinity, max = -1;
    labels.forEach(x => {
        if (x < min) { min = x; }
        if (x > max) { max = x; }
    });
    expect(min >= 0).toBe(true);
    expect(max < 5).toBe(true);

    // Works with a buffer.
    let buf = new scran.Int32WasmArray(20);
    let output2 = scran.labelCells(mat, refinfo, { buffer: buf });
    let labels2 = output2.labels;
    expect(compare.equalArrays(labels, labels2)).toBe(true);

    // Freeing the objects.
    refinfo.free();
    mat.free();
})

test("labelCells works correctly with intersections", () => {
    let ref = mockReferenceData(nlabels, profiles_per_label, nfeatures, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);

    let mat = simulate.simulateMatrix(nfeatures, 20);
    let output = scran.labelCells(mat, refinfo); // no intersection reference.
    expect(output.usedMarkers > 0).toBe(true);
    let labels = output.labels;

    // Throwing in some intersections.
    var inter = [];
    for (var i = 0; i < nfeatures; i++) {
        inter.push("Gene" + i);
    }

    let output2 = scran.labelCells(mat, refinfo, { geneNames: inter, referenceGeneNames: inter });
    expect(output2.usedMarkers > 0).toBe(true);
    let labels2 = output2.labels;
    expect(compare.equalArrays(labels, labels2)).toBe(true);

    // Shuffling the genes and checking we get a different result.
    var stat = inter.map(x => Math.random());
    var indices = inter.map((x, i) => i);
    indices.sort((a, b) => stat[a] - stat[b]);
    var inter2 = indices.map(i => inter[i]);

    let output3 = scran.labelCells(mat, refinfo, { geneNames: inter, referenceGeneNames: inter2 });
    let labels3 = output3.labels;
    expect(compare.equalArrays(labels, labels3)).toBe(false);

    // Freeing the objects.
    refinfo.free();
    mat.free();
});

