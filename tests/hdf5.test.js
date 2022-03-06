import * as scran from "../js/index.js";
import * as fs from "fs";
import * as compare from "./compare.js";
import * as hdf5 from "h5wasm";

beforeAll(async () => { 
    await scran.initialize({ localFile: true });
    await hdf5.ready;
});
afterAll(async () => { await scran.terminate() });

const dir = "hdf5-test-files";
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

function purge(path) {
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
}

test("HDF5 name queries work as expected (simple)", () => {
    const path = dir + "/test.name1.h5";
    purge(path)

    let f = new hdf5.File(path, "w");
    f.create_dataset("stuff", new Float64Array(1000), [20, 50]);
    f.close();

    // Checking we can extract the name correctly.
    let n = scran.extractHDF5ObjectNames(path);
    expect(n["stuff"]).toBe("float dataset");
    expect(Object.keys(n).length).toBe(1);
})

test("HDF5 name queries work as expected (groups)", () => {
    const path = dir + "/test.name2.h5";
    purge(path);

    let f = new hdf5.File(path, "w");
    f.create_group("foobar");
    f.get("foobar").create_dataset("data", new Uint32Array(100));
    f.get("foobar").create_dataset("indices", new Uint32Array(200));
    f.get("foobar").create_dataset("indptr", new BigUint64Array(300));
    f.get("foobar").create_dataset("shape", [200, 100], null, "<i");
    f.close();
 
    // Checking we can extract the name correctly.
    let n = scran.extractHDF5ObjectNames(path);
    expect(Object.keys(n).length).toBe(1);
    expect(Object.keys(n["foobar"]).length).toBe(4);

    expect(n["foobar"]["data"]).toBe("integer dataset");
    expect(n["foobar"]["indices"]).toBe("integer dataset");
    expect(n["foobar"]["indptr"]).toBe("integer dataset");
    expect(n["foobar"]["shape"]).toBe("integer dataset");
});

test("HDF5 name queries work as expected (nested groups)", () => {
    const path = dir + "/test.name3.h5";
    purge(path);

    let f = new hdf5.File(path, "w");
    f.create_group("foo");
    f.get("foo").create_group("bar");
    f.get("foo").create_dataset("whee", new Float32Array(100));
    f.get("foo").get("bar").create_dataset("stuff", ["A", "B", "C"], [3]);
    f.close();

    // Checking we can extract the name correctly.
    let n = scran.extractHDF5ObjectNames(path);
    expect(n["foo"] instanceof Object).toBe(true);
    expect(n["foo"]["bar"] instanceof Object).toBe(true);
    expect(n["foo"]["whee"]).toBe("float dataset");
    expect(n["foo"]["bar"]["stuff"]).toBe("string dataset");

    // Extracting in a subgroup.
    let n2 = scran.extractHDF5ObjectNames(path, { group: "foo" });
    expect(n2["whee"]).toBe("float dataset");
    expect(n2["bar"]["stuff"]).toBe("string dataset");

    // Extracting non-recursively.
    let n3 = scran.extractHDF5ObjectNames(path, { recursive: false });
    expect(Object.keys(n3).length).toBe(1);
    expect(Object.keys(n3["foo"]).length).toBe(0);

    let n4 = scran.extractHDF5ObjectNames(path, { recursive: false, group: "foo" });
    expect(Object.keys(n4).length).toBe(2);
    expect(Object.keys(n4["bar"]).length).toBe(0);
    expect(n4["whee"]).toBe("float dataset");
});

test("HDF5 dataset loading works as expected", () => {
    const path = dir + "/test.load.h5";
    purge(path)

    let x = new Float64Array(1000);
    x.forEach((y, i) => {
        x[i] = Math.random();
    });

    let y = new Int16Array(90);
    y.forEach((x, i) => {
        y[i] = Math.random() * 10;
    });

    let z = ["Aaron", "Jayaram", "Donald", "Joseph"]

    let f = new hdf5.File(path, "w");
    f.create_dataset("stuff", x, [20, 50]);
    f.create_dataset("whee", y, [90]);
    f.create_dataset("mamaba", z, [2, 2, 1]);
    f.close();

    var x2 = scran.loadHDF5Dataset(path, "stuff");
    expect(compare.equalArrays(x2.dimensions, [20, 50])).toBe(true);
    expect(compare.equalArrays(x2.contents, x)).toBe(true);

    var y2 = scran.loadHDF5Dataset(path, "whee");
    expect(compare.equalArrays(y2.dimensions, [90])).toBe(true);
    expect(compare.equalArrays(y2.contents, y)).toBe(true);

    var z2 = scran.loadHDF5Dataset(path, "mamaba");
    expect(compare.equalArrays(z2.dimensions, [2, 2, 1])).toBe(true);
    expect(compare.equalArrays(z2.contents, z)).toBe(true);
});

test("HDF5 dataset writing works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    // Nested group creation works.
    let fhandle = scran.createNewHDF5File(path);
    let ghandle = fhandle.createGroup("foo");
    let ghandle2 = ghandle.createGroup("bar");

    // Creation of numeric datasets works correctly.
    let add_dataset = (name, constructor, type, shape) => {
        let prod = shape.reduce((a, b) => a * b);
        let src = new constructor(prod);
        for (var i = 0; i < prod; i++) {
            src[i] = i;
        }

        let dhandle = ghandle2.createDataSet(name, type, shape);
        dhandle.write(src);
        
        let vals = dhandle.load();
        expect(vals.constructor.name).toBe(constructor.name);
        expect(compare.equalArrays(vals, src)).toBe(true);
    };

    add_dataset("u8", Uint8Array, "Uint8", [20, 4]);
    add_dataset("i8", Int8Array, "Int8", [5, 10, 4]);
    add_dataset("u16", Uint16Array, "Uint16", [100]);
    add_dataset("i16", Int16Array, "Int16", [5, 25]);
    add_dataset("u32", Uint32Array, "Uint32", [52]);
    add_dataset("i32", Int32Array, "Int32", [19, 13]);
    add_dataset("f32", Float32Array, "Float32", [50, 2]);
    add_dataset("f64", Float64Array, "Float64", [15, 20]);

    // Verifying everything landed in the right place.
    let fhandle_ = new scran.H5File(path);
    expect(fhandle_.children["foo"]).toBe("Group");
    let ghandle_ = fhandle_.open("foo");
    expect(ghandle_.children["bar"]).toBe("Group");
    let ghandle2_ = ghandle_.open("bar");
    expect(ghandle2_.children["u8"]).toBe("DataSet");
    
    // Checking the writing of strings.
    let dhandle = ghandle.createDataSet("stuff", "String", [5], { maxStringLength: 15 });
    let colleagues = ["Aaron", "Jayaram", "Michael", "Allison", "Sebastien"]; // ranked by amount of hair.

    dhandle.write(colleagues);
    let vals = dhandle.load();
    expect(compare.equalArrays(vals, colleagues)).toBe(true);
})

