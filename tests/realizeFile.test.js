import * as scran from "../js/index.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

beforeAll(async () => { await scran.initialize({ localFile: true }) });
afterAll(async () => { await scran.terminate() });

test("realizeFile works correctly for strings", () => {
    let tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "foo-"));
    let tmppath = path.join(tmpdir, "foo.txt");
    fs.writeFileSync(tmppath, "FOO");

    let realized = scran.realizeFile(tmppath);
    expect(realized.path).toEqual(tmppath);
    realized.flush();

    expect(fs.existsSync(tmppath)).toBe(true);
})

test("realizeFile works correctly for buffers", () => {
    let x = new Float64Array(10);
    for (var i = 0; i < x.length; i++) {
        x[i] = Math.random();
    }

    let realized = scran.realizeFile(new Uint8Array(x.buffer));
    expect(fs.existsSync(realized.path)).toBe(true);

    let contents = fs.readFileSync(realized.path);
    let roundtrip = new Float64Array(contents.buffer, contents.byteOffset, contents.length / 8);
    expect(roundtrip).toEqual(x);

    realized.flush();
    expect(fs.existsSync(realized.path)).toBe(false);
})

test("chooseTemporaryPath works correctly", () => {
    let temp = scran.chooseTemporaryPath();
    expect(fs.existsSync(temp)).toBe(false);

    let temp_ext = scran.chooseTemporaryPath({ extension: ".h5" });
    expect(temp_ext.endsWith(".h5")).toBe(true);
    expect(fs.existsSync(temp_ext)).toBe(false);
})

test("removeFile works correctly", () => {
    let tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "foo-"));
    let tmppath = path.join(tmpdir, "foo.txt");
    fs.writeFileSync(tmppath, "FOO");
    expect(fs.existsSync(tmppath)).toBe(true);
    
    scran.removeFile(tmppath);
    expect(fs.existsSync(tmppath)).toBe(false);

    // Works when file is already absent.
    scran.removeFile(tmppath);
    expect(fs.existsSync(tmppath)).toBe(false);
})

