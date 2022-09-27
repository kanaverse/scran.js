import * as scran from "../../js/index.js";
import * as compare from "../compare.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

const maybe = process.env.CHECK_RDS ? test : test.skip;
const path = "tests/rds/"

maybe("works for NULLs", () => {
    let stuff = scran.readRds(path + "test-null.rds");

    let vals = stuff.value();
    expect(vals.type()).toBe("null");
    expect(vals instanceof scran.RdsNull).toBe(true);

    vals.free();
    stuff.free();
})

maybe("works for integer vectors", () => {
    {
        let stuff = scran.readRds(path + "test-integer.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("integer");
        expect(vals instanceof scran.RdsIntegerVector).toBe(true);
        expect(vals.length()).toBe(5);

        let vec = vals.values();
        expect(vec instanceof Int32Array).toBe(true);
        expect(vec.length).toBe(5);
        expect(vec[0]).toBe(1);
        expect(vec[4]).toBe(5);

        vals.free();
        stuff.free();
    }

    {
        let stuff = scran.readRds(path + "test-named-integer.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("integer");
        expect(vals instanceof scran.RdsIntegerVector).toBe(true);
        expect(vals.attributeNames()).toEqual(["names"]);

        expect(vals.findAttribute("missing_attribute")).toEqual(-1);

        let attrhandle = vals.attribute(0);
        let attrvec = attrhandle.values();
        expect(attrvec[0]).toEqual("a");

        vals.free();
        stuff.free();
    }
})

maybe("works for double vectors", () => {
    {
        let stuff = scran.readRds(path + "test-double.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("double");
        expect(vals instanceof scran.RdsDoubleVector).toBe(true);
        expect(vals.length()).toBe(100);

        let vec = vals.values();
        expect(vec instanceof Float64Array).toBe(true);
        expect(vec.length).toBe(100);
        expect(vec[0]).toBeGreaterThan(0);
        expect(vec[99]).toBeGreaterThan(0);

        vals.free();
        stuff.free();
    }

    {
        let stuff = scran.readRds(path + "test-named-double.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("double");
        expect(vals instanceof scran.RdsDoubleVector).toBe(true);
        expect(vals.attributeNames()).toEqual(["names"]);

        let attrhandle = vals.attribute(0);
        let attrvec = attrhandle.values();
        expect(attrvec[0]).toEqual("foo1");

        attrhandle.free();
        vals.free();
        stuff.free();
    }
})

maybe("works for string vectors", () => {
    {
        let stuff = scran.readRds(path + "test-string.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("string");
        expect(vals instanceof scran.RdsStringVector).toBe(true);

        let vec = vals.values();
        expect(vec instanceof Array).toBe(true);
        expect(vec.length).toBe(26);
        expect(vec[0].length).toBe(1);
        expect(vec[25].length).toBe(1);

        vals.free();
        stuff.free();
    }

    {
        let stuff = scran.readRds(path + "test-named-string.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("string");
        expect(vals instanceof scran.RdsStringVector).toBe(true);

        let attrhandle = vals.attribute(0);
        let attrvec = attrhandle.values();
        expect(attrvec[0]).toEqual("bar1");

        attrhandle.free();
        vals.free();
        stuff.free();
    }
})

maybe("works for boolean vectors", () => {
    {
        let stuff = scran.readRds(path + "test-boolean.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("boolean");
        expect(vals instanceof scran.RdsBooleanVector).toBe(true);

        let vec = vals.values();
        expect(vec instanceof Int32Array).toBe(true);
        expect(vec.length).toBe(7);

        vals.free();
        stuff.free();
    }

    {
        let stuff = scran.readRds(path + "test-named-boolean.rds");

        let vals = stuff.value();
        expect(vals.type()).toBe("boolean");
        expect(vals instanceof scran.RdsBooleanVector).toBe(true);

        let attrhandle = vals.attribute(0);
        let attrvec = attrhandle.values();
        expect(attrvec[0]).toEqual("A");

        attrhandle.free();
        vals.free();
        stuff.free();
    }
})

maybe("works for unnamed list", () => {
    let stuff = scran.readRds(path + "test-list.rds");

    let vals = stuff.value();
    expect(vals.type()).toBe("vector");
    expect(vals instanceof scran.RdsGenericVector).toBe(true);

    {
        let e1 = vals.load(0);
        expect(e1 instanceof scran.RdsStringVector).toBe(true);

        let vec = e1.values();
        expect(vec.length).toBe(2);
        expect(vec[0]).toBe("Aaron");
        expect(vec[1]).toBe("Jayaram");

        e1.free();
    }

    {
        let e2 = vals.load(1);
        expect(e2 instanceof scran.RdsIntegerVector).toBe(true);

        let vec = e2.values();
        expect(vec.length).toBe(6);
        expect(vec[0]).toBe(6);
        expect(vec[5]).toBe(1);

        e2.free();
    }

    {
        let e3 = vals.load(2);
        expect(e3 instanceof scran.RdsNull).toBe(true);
        e3.free();
    }

    vals.free();
    stuff.free();
})

maybe("works for named list", () => {
    let stuff = scran.readRds(path + "test-named-list.rds");

    let vals = stuff.value();
    expect(vals.type()).toBe("vector");
    expect(vals instanceof scran.RdsGenericVector).toBe(true);

    {
        let e1 = vals.load(0);
        expect(e1 instanceof scran.RdsStringVector).toBe(true);

        let vec = e1.values();
        expect(vec.length).toBe(3);
        expect(vec[0]).toBe("Jaya");
        expect(vec[2]).toBe("Kancherla");

        e1.free();
    }

    {
        let e2 = vals.load(1);
        expect(e2 instanceof scran.RdsIntegerVector).toBe(true);

        let vec = e2.values();
        expect(vec.length).toBe(16);
        expect(vec[0]).toBe(16);
        expect(vec[15]).toBe(1);

        e2.free();
    }

    // The more important thing, check the attributes work.
    {
        let attr = vals.attributeNames();
        expect(attr).toEqual(["names"]);
        expect(vals.findAttribute('names')).toBe(0);

        let attrnames = vals.attribute(0);
        expect(attrnames instanceof scran.RdsStringVector).toBe(true);        

        let vec = attrnames.values();
        expect(vec).toEqual(["foxhound", "fortune"]);

        attrnames.free();
    }

    stuff.free();
})

maybe("works for S4 object", () => {
    let stuff = scran.readRds(path + "test-s4.rds");

    let vals = stuff.value();
    expect(vals.type()).toBe("S4");
    expect(vals instanceof scran.RdsS4Object).toBe(true);
    expect(vals.packageName()).toBe("Matrix");
    expect(vals.className()).toBe("dgCMatrix");

    let attrnames = vals.attributeNames();

    {
        let refi = attrnames.indexOf("i");
        expect(refi).toBeGreaterThan(-1);
        expect(vals.findAttribute("i")).toEqual(refi);

        let ihandle = vals.attribute(refi);
        expect(ihandle instanceof scran.RdsIntegerVector).toBe(true);

        let ivec = ihandle.values();
        expect(ivec instanceof Int32Array).toBe(true);

        ihandle.free();
    }

    {
        let refx = attrnames.indexOf("x");
        expect(refx).toBeGreaterThan(-1);
        expect(vals.findAttribute("x")).toEqual(refx);

        let xhandle = vals.attribute(refx);
        expect(xhandle instanceof scran.RdsDoubleVector).toBe(true);

        let xvec = xhandle.values();
        expect(xvec instanceof Float64Array).toBe(true);

        xhandle.free();
    }

    {
        let refp = attrnames.indexOf("p");
        expect(refp).toBeGreaterThan(-1);
        expect(vals.findAttribute("p")).toEqual(refp);

        let phandle = vals.attribute(refp);
        expect(phandle instanceof scran.RdsIntegerVector).toBe(true);

        let pvec = phandle.values();
        expect(pvec instanceof Int32Array).toBe(true);

        phandle.free();
    }

    expect(vals.findAttribute("missing_attribute")).toEqual(-1);

    stuff.free();
})
