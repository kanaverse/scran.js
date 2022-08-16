import * as scran from "../js/index.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

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
