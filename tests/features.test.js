import * as scran from "../js/index.js";
import * as compare from "./compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("guessFeatures works as expected for human and mouse", () => {
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

    // Force the taxonomy.
    output = scran.guessFeatures(["ENSG00000000003", "ENSG00000230003", "ENSG00111010210", "ENSG00000000004"], { forceTaxonomy: true });
    expect(output.species).toBe("9606");
    output = scran.guessFeatures(["Snap25", "Malat1", "ENSMUSG00111010210", "Cd8a"], { forceTaxonomy: true });
    expect(output.species).toBe("10090");
});

test("guessFeatures works as expected for some more exotic Ensembls", () => {
    let output = scran.guessFeatures(["ENSMFAG00000000003", "ENSMFAG00000230003", "asdasd"]);
    expect(output.confidence).toBe(2/3);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("9541");

    output = scran.guessFeatures(["ENSRNOG00000000003", "ENSRNOG00000230003", "asdasd"]);
    expect(output.confidence).toBe(2/3);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("10116");

    output = scran.guessFeatures(["Rps-2", "ENSDARG00000000003", "ENSDARG00000230003", "asdasd"]);
    expect(output.confidence).toBe(2/4);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("7955");

    output = scran.guessFeatures(["BLAH", "ENSPTRG00000000003", "ENSPTRG00000230003", "asdasd"]);
    expect(output.confidence).toBe(2/4);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("9598");

    output = scran.guessFeatures(["FBgn0035146", "FBgn0031106", "asdasd"]);
    expect(output.confidence).toBe(2/3);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("7227");

    output = scran.guessFeatures(["WBGene00001115", "WBGene00021460", "asdasd"]);
    expect(output.confidence).toBe(2/3);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("6239");
})

test("guessFeatures works as expected for some other symbols", () => {
    let output = scran.guessFeatures(["snap-26", "rbc-55", "act-2"]);
    expect(output.confidence).toBe(1);
    expect(output.type).toBe("symbol");
    expect(output.species).toBe("6239");

    output = scran.guessFeatures(["snap26", "rbc55a", "agrp"]);
    expect(output.confidence).toBe(1);
    expect(output.type).toBe("symbol");
    expect(output.species).toBe("7955");
})

test("guessFeatures handles null and non-string values properly", () => {
    let output = scran.guessFeatures(["ENSG00000000003", "ENSG00000230003", null]);
    expect(output.confidence).toBe(2/3);
    expect(output.type).toBe("ensembl");
    expect(output.species).toBe("human");

    let output2 = scran.guessFeatures(["ENSG00000000003", "ENSG00000230003", undefined]);
    expect(output2.confidence).toBe(2/3);
    expect(output2.type).toBe("ensembl");
    expect(output2.species).toBe("human");

    let output3 = scran.guessFeatures(["ENSG00000000003", "ENSG00000230003", 12345]);
    expect(output3.confidence).toBe(2/3);
    expect(output3.type).toBe("ensembl");
    expect(output3.species).toBe("human");
})

test("guessFeatures penalizes duplicates properly", () => {
    let positions = new Array(50);
    positions.fill("Chr1");

    let output = scran.guessFeatures(positions);
    expect(output.confidence).toBe(1/50);
    expect(output.type).toEqual("symbol");
    expect(output.species).toEqual("mouse");
})

