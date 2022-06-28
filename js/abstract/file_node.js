import * as fs from "fs";

export function writeFile(path, buffer) {
    fs.writeFileSync(path, new Uint8Array(buffer));
    return;
}

export function readFile(path) {
    let b = fs.readFileSync(path);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

export function removeFile(path) {
    fs.unlinkSync(path);
    return;
}

export function fileExists(path) {
    return fs.existsSync(path);
}

export function makeDirectory(path) {
    fs.mkdirSync(path);
    return;
}
