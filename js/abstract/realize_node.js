import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function temp(prefix, extension) {
    let tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    return path.join(tmpdir, "temp" + extension);
}

export function handleString(file) {
    return { 
        path: file, 
        flush: () => {} 
    };
}
