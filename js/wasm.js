import loadScran from "./wasm/scran.js";
import { register } from "wasmarrays.js";

const cache = {};

/**
 * @param {Object} [options] - Optional parameters.
 * @param {number} [options.numberOfThreads] - Number of threads to use for calculations.
 * This will spin up the requested number of Web Workers during module initialization.
 * @param {boolean} [options.localFile] - Whether or not to look for the Wasm and worker scripts locally.
 * This should only be `true` when using old versions of Node.js where file URLs are not supported, 
 * and is ignored completely outside of Node.js contexts.
 *
 * @return 
 * The Wasm bindings are initialized and `true` is returned.
 * If the bindings were already initialized (e.g., by a previous call), nothing is done and `false` is returned.
 */
export async function initialize({ numberOfThreads = 4, localFile = false } = {}) {
    if ("module" in cache) {
        return false;
    }

    let options = {
        scran_custom_nthreads: numberOfThreads
    };

    if (localFile) {                                                                /** NODE ONLY **/  
        options.locateFile = (x) => import.meta.url.substring(7) + "/../wasm/" + x; /** NODE ONLY **/
    }                                                                               /** NODE ONLY **/

    cache.module = await loadScran(options);
    cache.space = register(cache.module);

    return true;
}

export function call(func) {
    if (! ("module" in cache)) {
        throw new Error("Wasm module needs to be initialized via 'initialize()'");
    }

    var output;
    try {
        output = func(cache.module);    
    } catch (e) {
        if (typeof e == "number") {
            throw new Error(cache.module.get_error_message(e));
        } else {
            throw e;
        }
    }
    return output;
}

export function buffer() {
    if (! ("module" in cache)) {
        throw new Error("Wasm module needs to be initialized via 'initialize()'");
    }
    return cache.module.wasmMemory.buffer;
}

/**
 * @return Integer containing the **WasmArray** identifier for **scran.js**'s memory space.
 * This can be used with `WasmArray.createWasmArray()` and related functions.
 */
export function wasmArraySpace() {
    return cache.space;
}

/**
 * @return All worker threads are terminated and the module is deleted from the cache.
 * This is useful for cleaning up at the end of the analysis,
 * otherwise the workers will be shut done ungracefully on program exit.
 */
export function terminate() {
    cache.module.PThread.terminateAllThreads();
    delete cache.module;
    return;
}

/**
 * @return The current size of the Wasm heap, typically used for diagnostic reporting.
 */
export function heapSize() {
    return buffer().byteLength;
}

/**
 * @param {string} path - Path to the output file on the virtual file system.
 * @param {Uint8Array} buffer - Buffer to write to file.
 *
 * @return `buffer` is written to the binary file `path`.
 *
 * This is intended for use in web browsers to allow `initializeSparseMatrixFromHDF5` to work properly.
 * Node applications should not call this function (and it probably won't work anyway); 
 * rather, they can just read directly from the real file system.
 */
export function writeFile(path, buffer) {
    throw new Error("not supported in Node.js context"); /** NODE ONLY **/
    cache.module.FS.writeFile(path, buffer);
    return;
}

/**
 * @param {string} path - Path to a file on the virtual file system.
 *
 * @return A `Uint8Array` containing the binary contents of the file.
 *
 * This is intended for use in web browsers to load files written by the various HDF5 utilities.
 * Node applications should not call this function (and it probably won't work anyway); 
 * rather, they can just read directly from the real file system.
 */
export function readFile(path) {
    throw new Error("not supported in Node.js context"); /** NODE ONLY **/
    return cache.module.FS.readFile(path, { encoding: 'binary' });
}

/**
 * @param {string} path - Path to the file on the virtual file system.
 *
 * @return Deletes the specified file from the virtual file system.
 *
 * This is intended for use in web browsers to clean up after `writeFile()`.
 * Node applications should not call this function.
 */
export function removeFile(path) {
    throw new Error("not supported in Node.js context"); /** NODE ONLY **/
    cache.module.FS.unlink(path);
    return;
}

/**
 * @param {string} path - Path to the file on the virtual file system.
 * @return Boolean indicating whether the file exists.
 *
 * This is intended for use in web browsers. 
 * Node applications should not call this function.
 */
export function fileExists(path) {
    throw new Error("not supported in Node.js context"); /** NODE ONLY **/
    return cache.module.FS.analyzePath(path).exists;
}
