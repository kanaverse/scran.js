import * as scran from "../js/index.js";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

const dir = "Test-files";
if (!scran.fileExists(dir)) {
    scran.makeDirectory(dir);
}

test("readFile and writeFile works as expected", () => {
    let src = [1,2,3,4,5,6,7,8];
    scran.writeFile(dir + "/foo", new Uint8Array(src));
    expect(scran.fileExists(dir + "/foo")).toBe(true);

    let roundtrip = scran.readFile(dir + "/foo");
    expect(roundtrip.constructor.name).toBe("Uint8Array");
    expect(Array.from(roundtrip)).toEqual(src);

    scran.removeFile(dir + "/foo");
    expect(scran.fileExists(dir + "/foo")).toBe(false);
})
