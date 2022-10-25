import * as areal from "./abstract/realize.js";

/**
 * Realize a file so that it can be read by **scran.js** functions across both Node.js and browsers.
 *
 * @param {string|Uint8Array} file - In general, a Uint8Array buffer containing the file contents.
 * For Node.js, this may also be a string containing a path to a file.
 * @param {object} [options] - Optional parameters.
 * @param {string} [options.extension=""] - File extension to use for any temporary file that might be created.
 *
 * @return {Object} Object with the following properties:
 *
 * - `path`: a string containing the path to the file on the local filesystem (Node.js) or virtual file system (browsers).
 *   For Node.js, `file` is returned directly if it is already a path;
 *   otherwise, a new file will be created in the system's default temporary directory.
 * - `flush`: a function to be called to remove any temporary file created by this function.
 *   For Node.js, this will be a no-op of `file` is already a path. 
 */
export function realizeFile(file, { extension = "" } = {}) {
    return areal.realizeFile(file, { extension: extension });
}
