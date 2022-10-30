import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function writeFile(path, buffer) {
    fs.writeFileSync(path, buffer);
    return;
}

export function readFile(path) {
    let contents = fs.readFileSync(path);
    let abuffer = contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength);
    return new Uint8Array(abuffer);
}

export function removeFile(path) {
    fs.unlinkSync(path);
    return;
}

export function existsFile(path) {
    return fs.existsSync(path);
}
