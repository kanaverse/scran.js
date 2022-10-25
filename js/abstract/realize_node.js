import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function realizeFile(file, { prefix = "temp_", extension = "" } = {}) {
    if (typeof file == "string") {
        return { 
            path: file, 
            flush: () => {} 
        };
    }

    let tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    let tmppath = path.join(tmpdir, "temp" + extension);
    fs.writeFileSync(tmppath, file);

    return { 
        path: tmppath, 
        flush: () => fs.rmSync(tmpdir, { recursive: true })
    };
}
