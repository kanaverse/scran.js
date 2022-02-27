import * as scran from "../js/index.js";
import * as utils from "../js/utils.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("possibleCopy works as expected", () => {
    var basic = scran.createUint8WasmArray(100);
    var barray = basic.array();
    barray.forEach((x, i) => { barray[i] = i; });

    var copy1 = utils.possibleCopy(barray, true);
    expect(copy1.buffer === barray.buffer).toBe(false);
    expect(copy1[0]).toEqual(0);
    expect(copy1[99]).toEqual(99);

    var copy2 = utils.possibleCopy(barray, false);
    expect(copy2.buffer === barray.buffer).toBe(true);
    expect(copy2[0]).toEqual(0);
    expect(copy2[99]).toEqual(99);

    var copy3 = utils.possibleCopy(barray, "view");
    expect(copy3.constructor.className).toBe("Uint8WasmArray");
    expect(copy3.array()[0]).toEqual(0);
    expect(copy3.array()[99]).toEqual(99);
});

test("possibleCopy fails as expected", () => {
    var basic = new Uint8Array(100);
    basic.forEach((x, i) => { basic[i] = i; });

    var copied = false;
    try {
        utils.possibleCopy(basic, "view");
        copied = true;
    } catch (e) {
        expect(String(e)).toEqual(expect.stringMatching(/non-Wasm/));
    }
    expect(copied).toBe(false);
});
