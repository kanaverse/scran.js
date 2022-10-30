import * as methods from "../file.js";

export function temp(prefix, extension) {
    let tmppath;
    do {
        tmppath = prefix + String(Number(new Date())) + "_" + String(Math.round(Math.random() * 10000)) + extension;
    } while (methods.existsFile(tmppath));
    return tmppath;
}

export function handleString(file) {
    throw new Error("cannot access the file system in a browser context");
}
