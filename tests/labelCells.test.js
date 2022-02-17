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

test("labelCells works correctly", () => {
    let ref = mockReferenceData(5, 10, 1000, 20); 
    let refinfo = scran.loadLabelledReferenceFromBuffers(ref.ranks, ref.markers, ref.labels);
    expect(refinfo.numberOfLabels()).toBe(5);
    expect(refinfo.numberOfSamples()).toBe(50);
    expect(refinfo.numberOfFeatures()).toBe(1000);

    refinfo.free();
});

