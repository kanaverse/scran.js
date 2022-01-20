if ((typeof process !== 'undefined') && (process.release.name === 'node')) {
    import loadScran from "../wasm_node/scran.js";
} else {
    import loadScran from "../wasm/scran.js";
}

const cache = {};

/**
 * @param {Object} [options] - Optional parameters.
 * @param {number} [numberOfThreads] - Number of threads to use for calculations.
 * This will spin up the requested number of Web Workers during module initialization.
 *
 * @return 
 * The Wasm bindings are initialized and `true` is returned.
 * If the bindings were already initialized (e.g., by a previous call), nothing is done and `false` is returned.
 */
export async function initialize({ numberOfThreads = 4 } = {}) {
    if ("module" in cache) {
        return false;
    }

    let options = {
        // TODO: figure out a more portable way of finding the Wasm file.
        locateFile: (x) => import.meta.url.substring(7) + "/../../build/" + x,

        scran_custom_nthreads: numberOfThreads
    }

    // TODO: figure out how to add the thing for service workers.
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
