import * as wasm from "../wasm.js";

export function realize(file, { prefix = "temp_", extension = "" } = {}) {
    if (typeof file == "string") {
        throw new Error("cannot access the file system in a browser context");
    }

    // Choosing a decent path on the VFS.
    let tmppath;
    do {
        tmppath = prefix + String(Number(new Date())) + "_" + String(Math.round(Math.random() * 10000)) + extension;
    } while (wasm.existsVirtualFile(tmppath));

    wasm.writeVirtualFile(tmppath, file);
    return { 
        path: tmppath, 
        flush: () => wasm.removeVirtualFile(tmppath) 
    };
}
