import * as wasm from "../wasm.js";

export function writeFile(path, buffer) {
    wasm.call(module => module.FS.writeFile(path, buffer));
    return;
}

export function readFile(path) {
    return wasm.call(module => module.FS.readFile(path, { encoding: 'binary' }));
}

export function removeFile(path) {
    wasm.call(module => module.FS.unlink(path));
    return;
}

export function fileExists(path) {
    return wasm.call(module => module.FS.analyzePath(path).exists);
}

export function makeDirectory(path) {
    wasm.call(module => module.FS.mkdir(path));
    return;
}
