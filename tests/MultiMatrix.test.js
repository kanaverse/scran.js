import * as scran from "../js/index.js";
import * as simulate from "./simulate.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

var ncells = 100;
var ngenes = 1000;

test("MultiMatrix methods work as expected", () => {
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var multi = new scran.MultiMatrix({ store: { "RNA": mat } });

    expect(multi.numberOfColumns()).toBe(ncells);
    expect(multi.available()).toEqual(["RNA"]);

    expect(multi.has("RNA")).toBe(true);
    expect(multi.has("ADT")).toBe(false);
    expect(multi.get("RNA").numberOfRows()).toBe(ngenes);

    // Adding stuff works. 
    var ngenes2 = 10;
    var mat2 = simulate.simulateMatrix(ngenes2, ncells);
    multi.add("ADT", mat2);

    expect(multi.get("ADT").numberOfRows()).toBe(ngenes2);
    expect(multi.available().sort()).toEqual(["ADT", "RNA"]);

    // Renaming stuff works.
    multi.rename("ADT", "RNA");
    expect(multi.get("RNA").numberOfRows()).toBe(ngenes2);

    // Removing stuff works.
    multi.remove("RNA");
    expect(multi.numberOfColumns()).toBeNull();
    expect(multi.available().length).toBe(0);

    multi.free();
})

test("default MultiMatrix constructor works", () => {
    var multi = new scran.MultiMatrix;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    multi.add("RNA", mat);
    multi.free();
})

test("cloning a MultiMatrix works", () => {
    var multi = new scran.MultiMatrix;
    var mat = simulate.simulateMatrix(ngenes, ncells);
    multi.add("RNA", mat);

    let clone = multi.clone();
    multi.free();

    // Methods still work on the clone.
    expect(clone.get("RNA").numberOfColumns()).toEqual(ncells);
    expect(clone.get("RNA").numberOfRows()).toEqual(ngenes);
    clone.free();
})

test("MultiMatrix methods fail as expected", () => {
    var mat = simulate.simulateMatrix(ngenes, ncells);
    var mat2 = simulate.simulateMatrix(ngenes, ncells-1);
    expect(() => new scran.MultiMatrix({ store: { "RNA": mat, "ADT": mat2 } })).toThrow("same number of columns");

    var multi = new scran.MultiMatrix({ store: { "RNA": mat } });
    expect(() => multi.add("ADT", mat2)).toThrow("same number of columns");

    mat.free();
    mat2.free();
})
