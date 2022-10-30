import * as afile from "./abstract/file.js";

/**
 * Write a byte array to a path on the native file system (Node.js) or to the virtual file system (browser).
 *
 * @param {string} path - Path to the output file on the relevant file system.
 * @param {Uint8Array} buffer - Buffer to write to file.
 *
 * @return `buffer` is written to the binary file `path`.
 */
export function writeFile(path, buffer) {
    afile.writeFile(path, buffer);
    return;
}

/**
 * Read a byte array from a path on the native file system (Node.js) or the virtual file system (browser).
 *
 * @param {string} path - Path to a file on the relevant file system.
 *
 * @return {Uint8Array} Binary contents of the file.
 */
export function readFile(path) {
    return afile.readFile(path);
}

/**
 * Remove a file from the native file system (Node.js) or the virtual file system (browser).
 *
 * @param {string} path - Path to the file on the relevant file system.
 *
 * @return Deletes the specified file from the relevant file system.
 * If `path` does not exist, this function is a no-op.
 */
export function removeFile(path) {
    if (existsFile(path)) {
        afile.removeFile(path);
    }
    return;
}

/**
 * Check if a file exists on the native file system (Node.js) or the virtual file system (browser).
 *
 * @param {string} path - Path to the file on the relevant file system.
 *
 * @return {boolean} Whether the file exists.
 */
export function existsFile(path) {
    return afile.existsFile(path);
}
