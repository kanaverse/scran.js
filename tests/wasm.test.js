import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("wasm heap memory is reported correctly", () => {
    var thing = scran.createUint8WasmArray(1000);
    var usage = scran.heapSize();
    expect(usage > 1000).toBe(true);
    thing.free();
})

test("maximum number of threads is reported correctly", () => {
    expect(scran.maximumThreads()).toBeGreaterThan(0);
})
