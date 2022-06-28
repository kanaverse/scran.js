import * as afile from "./abstract/file.js";

/**
 * @param {string} path - Path to the output file.
 * On browsers, this should be a path on the virtual file system.
 * @param {Uint8Array} buffer - Buffer to write to file.
 *
 * @return `buffer` is written to the binary file `path`.
 */
export function writeFile(path, buffer) {
    afile.writeFile(path, buffer);
    return;
}

/**
 * @param {string} path - Path to a file. 
 * On browsers, this should be a path on the virtual file system. 
 *
 * @return {Uint8Array} Buffer containing the binary contents of the file.
 */
export function readFile(path) {
    return afile.readFile(path);
}

/**
 * @param {string} path - Path to the file. 
 * On browsers, this should be a path on the virtual file system. 
 *
 * @return Deletes the specified file from the virtual file system.
 */
export function removeFile(path) {
    afile.removeFile(path);
    return;
}

/**
 * @param {string} path - Path to the file.
 * On browsers, this should be a path on the virtual file system. 
 * @return {boolean} Whether the file exists.
 */
export function fileExists(path) {
    return afile.fileExists(path);
}

/**
 * @param {string} path - Path to the directory.
 * On browsers, this should be a path on the virtual file system. 
 * @return A directory is created at `path`.
 */
export function makeDirectory(path) {
    afile.makeDirectory(path);
    return;
}
