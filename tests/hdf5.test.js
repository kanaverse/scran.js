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
    let n = scran.extractHdf5ObjectNames(path);
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
    let n = scran.extractHdf5ObjectNames(path);
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
    let n = scran.extractHdf5ObjectNames(path);
    expect(n["foo"] instanceof Object).toBe(true);
    expect(n["foo"]["bar"] instanceof Object).toBe(true);
    expect(n["foo"]["whee"]).toBe("float dataset");
    expect(n["foo"]["bar"]["stuff"]).toBe("string dataset");

    // Extracting in a subgroup.
    let n2 = scran.extractHdf5ObjectNames(path, { group: "foo" });
    expect(n2["whee"]).toBe("float dataset");
    expect(n2["bar"]["stuff"]).toBe("string dataset");

    // Extracting non-recursively.
    let n3 = scran.extractHdf5ObjectNames(path, { recursive: false });
    expect(Object.keys(n3).length).toBe(1);
    expect(Object.keys(n3["foo"]).length).toBe(0);

    let n4 = scran.extractHdf5ObjectNames(path, { recursive: false, group: "foo" });
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

    var x2 = scran.loadHdf5Dataset(path, "stuff");
    expect(compare.equalArrays(x2.dimensions, [20, 50])).toBe(true);
    expect(compare.equalArrays(x2.contents, x)).toBe(true);

    var y2 = scran.loadHdf5Dataset(path, "whee");
    expect(compare.equalArrays(y2.dimensions, [90])).toBe(true);
    expect(compare.equalArrays(y2.contents, y)).toBe(true);

    var z2 = scran.loadHdf5Dataset(path, "mamaba");
    expect(compare.equalArrays(z2.dimensions, [2, 2, 1])).toBe(true);
    expect(compare.equalArrays(z2.contents, z)).toBe(true);
});

test("HDF5 group creation works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    // Nested group creation works.
    let fhandle = scran.createNewHdf5File(path);
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

    let fhandle = scran.createNewHdf5File(path);
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

test("findMaxStringLength works as expected", () => {
    expect(scran.findMaxStringLength(["a", "bb", "CCC", "d"], null)).toEqual(3);
    expect(scran.findMaxStringLength(["aa", "bbbbb", "CCC", "dd"], null)).toEqual(5);
    expect(scran.findMaxStringLength(["aa", "β-globin", "C", "d"], null)).toEqual(9); // works with unicode.

    expect(scran.findMaxStringLength([{ foo: "A", bar: "CC" }, { foo: "aaa", bar: "D" }], ["foo", "bar"])).toEqual([3, 2]);
    expect(scran.findMaxStringLength([{ foo: "α2-macroglobulin", bar: "CC" }, { foo: "aaa", bar: "180π" }], ["foo", "bar"])).toEqual([17, 5]); // works with unicode.
})

test("HDF5 string dataset creation works as expected", () => {
    const options = [
        { type: "String", maxStringLength: null },
        { type: "String", maxStringLength: 15 },
        { type: new scran.H5StringType("UTF-8", 15), maxStringLength: null },
        { type: new scran.H5StringType("UTF-8", scran.H5StringType.variableLength), maxStringLength: null },
        { type: new scran.H5StringType("ASCII", scran.H5StringType.variableLength), maxStringLength: null }
    ];

    const path = dir + "/test.write.h5";
    const colleagues = ["Aaron", "Jayaram", "Michael", "Allison", "Sebastien"]; // ranked by amount of hair.

    for (const { type, maxStringLength } of options) {
        purge(path)
        let fhandle = scran.createNewHdf5File(path);
        let ghandle = fhandle.createGroup("foo");

        // Checking the writing of strings.
        {
            let str_dhandle = ghandle.createDataSet("stuff", type, [5], { maxStringLength });
            str_dhandle.write(colleagues);

            let str_dhandle2 = ghandle.open("stuff");
            expect(str_dhandle2.type instanceof scran.H5StringType).toBe(true);
            expect(str_dhandle2.type.encoding).toBe(str_dhandle.type.encoding);
            expect(str_dhandle2.type.length).toBe(str_dhandle.type.length);
            expect(compare.equalArrays(str_dhandle2.values, colleagues)).toBe(true);
        }

        {
            let str_shandle = ghandle.createDataSet("whee", type, [], { maxStringLength });
            str_shandle.write("Bummer");

            let str_shandle2 = ghandle.open("whee");
            expect(str_shandle2.type instanceof scran.H5StringType).toBe(true);
            expect(str_shandle2.type.encoding).toBe(str_shandle.type.encoding);
            expect(str_shandle2.type.length).toBe(str_shandle.type.length);
            expect(str_shandle2.values).toEqual(["Bummer"]);
        }

        expect(() => ghandle.writeDataSet("foobar", type, [3], [1,2,3])).toThrow(/Cannot pass non-string/)

        // Checking that the quick writer works.
        {
            let str_dhandleX = ghandle.writeDataSet("stuffX", type, [5], colleagues, { maxStringLength });
            expect(str_dhandleX instanceof scran.H5DataSet);

            let str_dhandleX2 = ghandle.open("stuffX");
            expect(str_dhandleX2.type instanceof scran.H5StringType).toBe(true);
            expect(str_dhandleX2.type.encoding).toBe(str_dhandleX.type.encoding);
            expect(str_dhandleX2.type.length).toBe(str_dhandleX.type.length);
            expect(compare.equalArrays(str_dhandleX.values, colleagues)).toBe(true);
        }

        // Checking that the quick string writer gets the lengths right with unicode. 
        if (type instanceof scran.H5StringType && type.encoding == "UTF-8") {
            let complicated = "β-globin";
            let str_shandle2 = ghandle.writeDataSet("whee2", type, [], complicated);
            let content2 = str_shandle2.values;
            expect(content2[0]).toBe(complicated);
        }

        // Checking that it works fine with empty strings.
        {
            let str_ehandle = ghandle.writeDataSet("whee3", type, [3], ["", "", ""]);
            expect(str_ehandle instanceof scran.H5DataSet);

            let str_ehandle2 = ghandle.open("whee3");
            expect(str_ehandle2.type instanceof scran.H5StringType).toBe(true);
            expect(str_ehandle2.type.encoding).toBe(str_ehandle.type.encoding);
            expect(str_ehandle2.type.length).toBe(str_ehandle.type.length == 0 ? 1 : str_ehandle.type.length); // minimum of 1, otherwise HDF5 complains.
            expect(str_ehandle2.values).toEqual(["", "", ""]);
        }
    }
})

test("HDF5 enum dataset creation and loading works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    let fhandle = scran.createNewHdf5File(path);

    // Using the auto-leveller.
    {
        let idols = [ "uzuki", "shizuka", "kaori", "kaede", "shizuka", "uzuki" ];
        fhandle.writeDataSet("idols", "Enum", [2,3], idols);

        let dhandle2 = fhandle.open("idols", { load: true });
        expect(dhandle2.values).toEqual(new Int32Array([3,2,1,0,2,3]));
        expect(dhandle2.levels).toEqual({"kaede": 0, "kaori": 1, "shizuka": 2, "uzuki": 3});
        expect(dhandle2.shape).toEqual([2, 3]);
    }

    // Using explicit levels.
    {
        let idol_levels = [ "rin", "mio", "mika", "rika" ]
        let idol_chosen = [3,1,2,0,0,2,1,1];
        fhandle.writeDataSet("idols2", "Enum", [4,2], idol_chosen, { levels: idol_levels });

        let dhandle2 = fhandle.open("idols2", { load: true });
        expect(dhandle2.values).toEqual(new Int32Array(idol_chosen));
        expect(dhandle2.levels).toEqual({ "rin": 0, "mio": 1, "mika": 2, "rika": 3 });
        expect(dhandle2.shape).toEqual([4, 2]);
    }

    // Using the type class with a custom mapping.
    {
        let idol_levels = { "ranko": 5, "anzu": 2, "minami": 7, "kirari": 4 };
        let idol_chosen = [5,4,2,5,2,7];
        fhandle.writeDataSet("idols3", new scran.H5EnumType("Uint8", idol_levels), [6], idol_chosen);

        let dhandle2 = fhandle.open("idols3", { load: true });
        expect(dhandle2.values).toEqual(new Uint8Array(idol_chosen));
        expect(dhandle2.levels).toEqual(idol_levels);
        expect(dhandle2.shape).toEqual([6]);
    }
})

test("HDF5 64-bit integer dataset creation works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    {
        let fhandle = scran.createNewHdf5File(path);
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

test("HDF5 compound dataset creation and loading works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    let data = [ { foo: 1, bar: 1.5 }, { foo: 2, bar: 2.5 }, { foo: 3, bar: 3.5 }, { foo: 4, bar: 4.5 }, { foo: 5, bar: 5.5 } ];
    {
        let fhandle = scran.createNewHdf5File(path);
        fhandle.writeDataSet("compound", new scran.H5CompoundType({ "foo": "Int32", "bar": "Float64" }), null, data);
    }

    {
        let fhandle = new scran.H5File(path);
        let dhandle = fhandle.open("compound");
        expect(dhandle.values).toEqual(data);
        expect(dhandle.type.members).toEqual({ "foo": "Int32", "bar": "Float64" });;
    }

    // Works for strings as well.
    data = [ { foo: "a", bar: "A" }, { foo: "bb", bar: "BB" }, { foo: "ccc", bar: "CCC" }, { foo: "dddd", bar: "DDDD" }, { foo: "eeeee", bar: "EEEEE" } ];
    {
        let fhandle = scran.createNewHdf5File(path);
        let ctype = new scran.H5CompoundType({ foo: new scran.H5StringType("UTF-8", 5), bar: new scran.H5StringType("ASCII", scran.H5StringType.variableLength) });
        fhandle.writeDataSet("compound", ctype, null, data);
    }

    {
        let fhandle = new scran.H5File(path);
        let dhandle = fhandle.open("compound");
        expect(dhandle.values).toEqual(data);
        expect(Object.keys(dhandle.type.members)).toEqual(["foo", "bar"]);
        expect(dhandle.type.members.foo.length).toEqual(5);
        expect(dhandle.type.members.bar.encoding).toEqual("ASCII");
    }
})

test("HDF5 numeric attribute creation and loading works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    let fhandle = scran.createNewHdf5File(path);
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
    const options = [
        { type: "String", maxStringLength: null },
        { type: "String", maxStringLength: 15 },
        { type: new scran.H5StringType("UTF-8", 15), maxStringLength: null },
        { type: new scran.H5StringType("UTF-8", scran.H5StringType.variableLength), maxStringLength: null },
        { type: new scran.H5StringType("ASCII", scran.H5StringType.variableLength), maxStringLength: null }
    ];

    const path = dir + "/test.write.h5";
    const colleagues = ["Allison", "Aaron", "Jayaram", "Michael", "Sebastien"]; // ranked by age.

    for (const { type, maxStringLength } of options) {
        purge(path)
        const fhandle = scran.createNewHdf5File(path);

        {
            let dhandle = fhandle.writeDataSet("stuffX", "Int32", null, [1,2,3,4,5]);
            dhandle.writeAttribute("colleagues", type, null, colleagues, { maxStringLength });
            expect(dhandle.attributes.indexOf("colleagues")).toBe(0);
        }

        // Make sure we get the same thing out.
        {
            let dhandle2 = fhandle.open("stuffX");
            expect(dhandle2.attributes.indexOf("colleagues")).toBe(0);

            let recolleagues = dhandle2.readAttribute("colleagues");
            expect(recolleagues.values).toEqual(colleagues);
            expect(recolleagues.type instanceof scran.H5StringType).toBe(true);
            expect(recolleagues.shape).toEqual([5]);
        }
    }
})

test("HDF5 enum attribute creation and loading works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    let fhandle = scran.createNewHdf5File(path);
    let dhandle = fhandle.writeDataSet("stuffX", "Int32", null, [1,2,3,4,5]);

    // Using the auto-leveller.
    {
        let idols = ["chihaya", "haruka", "miki", "miki", "haruka", "chihaya"];
        dhandle.writeAttribute("idols", "Enum", null, idols);
        expect(dhandle.attributes.indexOf("idols")).toBe(0);

        let dhandle2 = fhandle.open("stuffX");
        expect(dhandle2.attributes.indexOf("idols")).toBe(0);

        let reidols = dhandle2.readAttribute("idols");
        expect(reidols.values).toEqual(new Int32Array([0,1,2,2,1,0]));
        expect(reidols.levels).toEqual({"chihaya":0,"haruka":1, "miki":2});
        expect(reidols.shape).toEqual([6]);
    }

    // Using explicit levels.
    {
        let idol_levels = ["iori", "mami", "ami", "azusa", "takane"];
        let idol_chosen = [4,1,2,3,0,0,1,1,2];
        dhandle.writeAttribute("idols2", "Enum", null, idol_chosen, { levels: idol_levels });
        expect(dhandle.attributes.indexOf("idols2")).toBe(1);

        let dhandle2 = fhandle.open("stuffX");
        expect(dhandle2.attributes.indexOf("idols2")).toBe(1);

        let reidols = dhandle2.readAttribute("idols2");
        expect(reidols.values).toEqual(new Int32Array(idol_chosen));
        expect(reidols.levels).toEqual({iori:0, mami:1, ami:2, azusa:3, takane:4});
        expect(reidols.shape).toEqual([idol_chosen.length]);
    }

    // Using the type class with a custom mapping.
    {
        let idol_levels = { "ranko": 5, "anzu": 2, "minami": 7, "kirari": 4 };
        let idol_chosen = [5,4,2,5,2,7];
        dhandle.writeAttribute("idols3", new scran.H5EnumType("Uint16", idol_levels), null, idol_chosen);
        expect(dhandle.attributes.indexOf("idols3")).toBe(2);

        let dhandle2 = fhandle.open("stuffX");
        expect(dhandle2.attributes.indexOf("idols3")).toBe(2);

        let reidols = dhandle2.readAttribute("idols3");
        expect(reidols.values).toEqual(new Uint16Array(idol_chosen));
        expect(reidols.type.levels).toEqual(idol_levels);
        expect(reidols.shape).toEqual([idol_chosen.length]);
    }
})

test("HDF5 compound attribute creation and loading works as expected", () => {
    const path = dir + "/test.write.h5";
    purge(path)

    let data = { foo: 1, bar: 1.5 }
    {
        let fhandle = scran.createNewHdf5File(path);
        let ghandle = fhandle.createGroup("whee");
        ghandle.writeAttribute("compound", new scran.H5CompoundType({ "foo": "Int32", "bar": "Float64" }), null, data);
    }

    {
        let fhandle = new scran.H5File(path);
        let ghandle = fhandle.open("whee");
        let res = ghandle.readAttribute("compound");
        expect(res.values).toEqual([data]);
        expect(res.type.members).toEqual({ "foo": "Int32", "bar": "Float64" });
        expect(res.shape).toEqual([]);
    }
})
