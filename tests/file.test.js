import * as scran from "../js/index.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

test("file utilities work correctly", () => {
    let tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "foo-"));
    let tmppath = path.join(tmpdir, "foo.txt");

    const enc = new TextEncoder;
    let buffer = enc.encode("Aaron was here");
    scran.writeFile(tmppath, buffer);
    expect(fs.existsSync(tmppath)).toBe(true);
    expect(scran.existsFile(tmppath)).toBe(true);

    let roundtrip = scran.readFile(tmppath);
    const dec = new TextDecoder;
    let output = dec.decode(roundtrip);
    expect(output).toBe("Aaron was here");
    
    scran.removeFile(tmppath);
    expect(fs.existsSync(tmppath)).toBe(false);
    expect(scran.existsFile(tmppath)).toBe(false);

    // Works when file is already absent.
    scran.removeFile(tmppath);
    expect(fs.existsSync(tmppath)).toBe(false);
})

