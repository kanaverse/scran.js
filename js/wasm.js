import loadScran from "./wasm/scran.js";
const cache = {};

/**
 * @param {Object} [options] - Optional parameters.
 * @param {number} [numberOfThreads] - Number of threads to use for calculations.
 * This will spin up the requested number of Web Workers during module initialization.
 * @param {boolean} [localFile] - Whether or not to look for the Wasm and worker scripts locally.
 * Should only be `true` when using old versions of Node where file URLs are not supported.
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
    }

    if (localFile) {
        options.locateFile = (x) => import.meta.url.substring(7) + "/../wasm/" + x;
    }

    cache.module = await loadScran(options);

    return true;
}

export function call(func) {
    if (! ("module" in cache)) {
        throw "Wasm module needs to be initialized via 'initialize()'";
    }

    var output;
    try {
        output = func(cache.module);    
    } catch (e) {
        if (e instanceof Number) {
            throw cache.module.get_error_message(e);
        } else {
            throw e;
        }
    }
    return output;
}

export function buffer() {
    if (! ("module" in cache)) {
        throw "Wasm module needs to be initialized via 'initialize()'";
    }
    return cache.module.wasmMemory.buffer;
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
