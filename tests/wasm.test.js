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

test("filesystem operations fail for Node", () => {
    expect(() => scran.writeVirtualFile("asdasd", new Uint8Array(10))).toThrow("virtual");
    expect(() => scran.removeVirtualFile("asdasd")).toThrow("virtual");
    expect(() => scran.readVirtualFile("asdasd")).toThrow("virtual");
    expect(() => scran.existsVirtualFile("asdasd")).toThrow("virtual");
})
