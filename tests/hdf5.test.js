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

test("HDF5 group creation works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    // Nested group creation works.
    let fhandle = scran.createNewHDF5File(path);
    expect(fhandle.children).toEqual({});

    let ghandle = fhandle.createGroup("foo");
    expect(fhandle.children).toEqual({ "foo": "Group" });

    let ghandle2 = ghandle.createGroup("bar");
    expect(ghandle.children).toEqual({ "bar": "Group" });

    // No-ops when the group already exists.
    {
        let ghandle3 = fhandle.createGroup("foo");
        expect("bar" in ghandle3.children).toBe(true);
    }

    // Check that we get the same result with a fresh handle.
    let rehandle = new scran.H5File(path);
    expect(rehandle.children).toEqual({ "foo": "Group" });

    let reghandle = rehandle.open("foo");
    expect(reghandle.children).toEqual({ "bar": "Group" });
})

test("HDF5 numeric dataset creation works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

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
        expect(ghandle2.children[name]).toBe("DataSet");

        // We get back what we put in.
        {
            let dhandle2 = ghandle2.open(name);
            expect(dhandle2.shape).toEqual(shape);
            let vals = dhandle2.load();
            expect(vals.constructor.name).toBe(constructor.name);
            expect(compare.equalArrays(vals, src)).toBe(true);
        }

        // Fails for nulls or strings
        expect(() => dhandle.write(null)).toThrow(/null/);
        let strtmp = new Array(prod);
        strtmp.fill("A");
        expect(() => dhandle.write(strtmp)).toThrow(/string/);

        // Works for scalar datasets.
        let scalar = name + "_scalar";
        {
            let dhandle2 = ghandle2.createDataSet(scalar, type, []);
            dhandle2.write(100);
        }
        {
            let dhandle2 = ghandle2.open(scalar);
            expect(dhandle2.shape).toEqual([]);
            let vals2 = dhandle2.load();
            expect(vals2.length).toBe(1);
            expect(vals2[0]).toBe(100);
        }
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
    let ghandle_ = fhandle_.open("foo");
    let ghandle2_ = ghandle_.open("bar");
    expect(ghandle2_.children["u8"]).toBe("DataSet");

    let dhandle_ = ghandle2_.open("u8");
    expect(dhandle_.type).toBe("Uint8");
    expect(dhandle_.shape).toStrictEqual([20, 4]);
    let shandle_ = ghandle2_.open("i8_scalar");
    expect(shandle_.type).toBe("Int8");
    expect(shandle_.shape).toStrictEqual([]);

    // Checking that the quick writer works.
    let qhandle = ghandle.writeDataSet("stuffX", "Int32", null, [1,2,3,4,5]);
    let qvec = qhandle.load();
    expect(qvec[0]).toBe(1);
    expect(qvec[4]).toBe(5);

    let qhandle2 = ghandle.writeDataSet("stuffY", "Int32", [], 12345);
    let qscalar = qhandle2.load();
    expect(qscalar[0]).toBe(12345);

    // Checking that empty writers are sane.
    let ehandle = ghandle.writeDataSet("stuffZ", "Int32", [0], []);
    let empty = ehandle.load();
    expect(empty.constructor.name).toBe("Int32Array");
    expect(empty.length).toBe(0);

    expect(() => ghandle.writeDataSet("stuffZ", "Int32", [0], null)).toThrow(/null/)
})

test("HDF5 string dataset creation works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    let fhandle = scran.createNewHDF5File(path);
    let ghandle = fhandle.createGroup("foo");

    // Checking the writing of strings.
    let str_dhandle = ghandle.createDataSet("stuff", "String", [5], { maxStringLength: 15 });
    let colleagues = ["Aaron", "Jayaram", "Michael", "Allison", "Sebastien"]; // ranked by amount of hair.

    str_dhandle.write(colleagues);
    let vals = str_dhandle.load();
    expect(compare.equalArrays(vals, colleagues)).toBe(true);

    let str_shandle = ghandle.createDataSet("whee", "String", [], { maxStringLength: 15 });
    str_shandle.write("Bummer");
    let content = str_shandle.load();
    expect(content[0]).toBe("Bummer");

    expect(() => ghandle.writeDataSet("foobar", "String", [3], [1,2,3])).toThrow(/strings/)

    // Checking that the quick writer works.
    let str_dhandleX = ghandle.writeDataSet("stuffX", "String", [5], colleagues);
    let valsX = str_dhandleX.load();
    expect(compare.equalArrays(valsX, colleagues)).toBe(true);

    // Checking that the quick string writer gets the lengths right with unicode. 
    let complicated = "β-globin";
    let str_shandle2 = ghandle.writeDataSet("whee2", "String", [], complicated);
    let content2 = str_shandle2.load();
    expect(content2[0]).toBe(complicated);

    // Checking that it works fine with empty strings.
    let str_shandle3 = ghandle.writeDataSet("whee3", "String", [3], ["", "", ""]);
    let content3 = str_shandle3.load();
    expect(content3.length).toBe(3);
    expect(content3[0]).toBe("");
    expect(content3[1]).toBe("");
    expect(content3[2]).toBe("");
})

test("HDF5 64-bit integer dataset creation works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    {
        let fhandle = scran.createNewHDF5File(path);
        fhandle.writeDataSet("stuffi", "Int64", null, [1,2,3,4,5]);
        fhandle.writeDataSet("stuffu", "Uint64", null, [6,7,8,9,10]);
    }

    // Pulling it out successfully. This uses doubles instead of
    // BigInts, given that the latter isn't embind'd properly.
    {
        let fhandle = new scran.H5File(path);
        let ires = fhandle.open("stuffi", { load: true }).values;
        expect(ires[0]).toBe(1);
        expect(ires[4]).toBe(5);

        let ures = fhandle.open("stuffu", { load: true }).values;
        expect(ures[0]).toBe(6);
        expect(ures[4]).toBe(10);
    }
})

test("HDF5 numeric attribute creation and loading works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    let fhandle = scran.createNewHDF5File(path);
    let ghandle = fhandle.createGroup("foo");

    // Creation of numeric attributes works correctly.
    let add_attribute = (name, constructor, type, shape) => {
        let prod = shape.reduce((a, b) => a * b);
        let src = new constructor(prod);
        for (var i = 0; i < prod; i++) {
            src[i] = i;
        }

        ghandle.writeAttribute(name, type, shape, src);

        // We get back what we put in.
        {
            let bundle = ghandle.readAttribute(name);
            expect(compare.equalArrays(bundle.values, src)).toBe(true);
            expect(bundle.shape).toEqual(shape);
        }

        // Fails for nulls or strings
        expect(() => ghandle.writeAttribute(name + "_null", type, shape, null)).toThrow(/null/);
        let strtmp = new Array(prod);
        strtmp.fill("A");
        expect(() => ghandle.writeAttribute(name + "_string", type, shape, strtmp)).toThrow(/string/);

        // Works for scalar datasets.
        let scalar = name + "_scalar";
        ghandle.writeAttribute(scalar, type, [], 100);
        {
            let bundle = ghandle.readAttribute(scalar);
            expect(Array.from(bundle.values)).toEqual([100]);
            expect(bundle.shape).toEqual([]);
        }
    };

    add_attribute("thingy_int8", Int8Array, "Int8", [5,2,1]);
    add_attribute("thingy_uint8", Uint8Array, "Uint8", [4,4]);
    add_attribute("thingy_int16", Int16Array, "Int16", [123]);
    add_attribute("thingy_uint16", Uint16Array, "Uint16", [3,2,3]);
    add_attribute("thingy_int32", Int32Array, "Int32", [111,2]);
    add_attribute("thingy_uint32", Uint32Array, "Uint32", [50,2]);
    add_attribute("thingy_float32", Float32Array, "Float32", [20,20]);
    add_attribute("thingy_float64", Float64Array, "Float64", [9]);

    let ghandle2 = fhandle.open("foo");
    expect(ghandle2.attributes).toEqual(ghandle.attributes); // got added correctly.

    let attrs = new Set(ghandle2.attributes);
    expect(attrs.has("thingy_int8")).toBe(true);
    expect(attrs.has("thingy_uint16")).toBe(true);
    expect(attrs.has("thingy_float32_scalar")).toBe(true);
})

test("HDF5 string attribute creation and loading works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    let fhandle = scran.createNewHDF5File(path);
    let dhandle = fhandle.writeDataSet("stuffX", "Int32", null, [1,2,3,4,5]);

    let colleagues = ["Allison", "Aaron", "Jayaram", "Michael", "Sebastien"]; // ranked by age.
    dhandle.writeAttribute("colleagues", "String", null, colleagues);
    expect(dhandle.attributes.indexOf("colleagues")).toBe(0);

    // Make sure we get the same thing out.
    {
        let dhandle2 = fhandle.open("stuffX");
        expect(dhandle2.attributes.indexOf("colleagues")).toBe(0);

        let recolleagues = dhandle2.readAttribute("colleagues");
        expect(recolleagues.values).toEqual(colleagues);
        expect(recolleagues.shape).toEqual([5]);
    }
})

test("HDF5 enum reading and writing works as expected", () => {
    const path = dir + "/test.load.h5";
    purge(path)
})


