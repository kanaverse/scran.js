import loadScran from "./wasm/scran.js";
import { register } from "wasmarrays.js";
import * as afile from "./abstract/file.js";

const cache = {};

/**
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.numberOfThreads=4] - Number of threads to use for calculations.
 * This will spin up the requested number of Web Workers during module initialization.
 * @param {boolean} [options.localFile=false] - Whether or not to look for the Wasm and worker scripts locally.
 * This should only be `true` when using old versions of Node.js where file URLs are not supported, 
 * and is ignored completely outside of Node.js contexts.
 *
 * @return {boolean}
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

/**
 * Maximum number of threads available for computation.
 * This depends on the value specified during module initialization in {@linkcode initialize}. 
 *
 * @return {number} Maximum number of available threads.
 */
export function maximumThreads() {
    return cache.module.scran_custom_nthreads;
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
 * @return {number} Integer containing the **wasmarrays.js** identifier for **scran.js**'s memory space.
 * This can be used with `createWasmArray()` and related functions from **wasmarrays.js**.
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
 * @return {number} The current size of the Wasm heap, typically used for diagnostic reporting.
 */
export function heapSize() {
    return buffer().byteLength;
}
