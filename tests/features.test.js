import * as scran from "../js/index.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("matchFeatureAnnotationToRowIdentities works as expected", () => {
    // First two rows contain elements beyond the range of the smaller integer,
    // and thus are shuffled to the back.
    var vals = scran.createInt32WasmArray(15);
    vals.set([1, 5, 2, 1000000, 10, 8, 1000, 10, 4, 2, 1, 1, 3, 5, 8]); 
    var indices = scran.createInt32WasmArray(15);
    indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
    var indptrs = scran.createInt32WasmArray(11);
    indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);
    var mat = scran.initializeSparseMatrixFromCompressedVectors(11, 10, vals, indices, indptrs);

    // Checking the reorganization.
    let info = { 
        "thing": [ "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K" ],
        "stuff": [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ] 
    };
    scran.matchFeatureAnnotationToRowIdentities(mat, info);

    expect(compare.equalArrays(info.thing, ["C", "D", "E", "F", "G", "H", "I", "J", "K", "B", "A"])).toBe(true);
    expect(compare.equalArrays(info.stuff, [2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 0])).toBe(true);
});

test("guessFeatures works as expected", () => {
    let output = scran.guessFeatures(["ENSG00000000003", "ENSG00000230003", "asdasd"]);
    expect(output.confidence).toBe(2/3);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("human");

    output = scran.guessFeatures(["ENSMUSG00000000003", "ENSG00000230003", "ENSMUSG00111010210", "ENSMUSG00000000004"]);
    expect(output.confidence).toBe(3/4);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("mouse");

    output = scran.guessFeatures(["SNAP25", "MALAT1", "ENSMUSG00111010210", "ACTB4"]);
    expect(output.confidence).toBe(3/4);
    expect(output.type).toBe("symbol");
    expect(output.species).toBe("human");

    output = scran.guessFeatures(["Snap25", "Malat1", "ENSMUSG00111010210", "Cd8a"]);
    expect(output.confidence).toBe(3/4);
    expect(output.type).toBe("symbol");
    expect(output.species).toBe("mouse");
});

test("guessFeatures handles null values properly", () => {
    let output = scran.guessFeatures(["ENSG00000000003", "ENSG00000230003", null]);
    expect(output.confidence).toBe(2/3);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("human");

    let output2 = scran.guessFeatures(["ENSG00000000003", "ENSG00000230003", undefined]);
    expect(output2.confidence).toBe(2/3);
    expect(output2.type).toBe("ensembl");
    expect(output2.species).toBe("human");
})
