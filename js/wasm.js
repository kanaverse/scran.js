import loadScran from "../build/scran.js";

const cache = {};

export async function initialize(options = {}) {
    if (! ("module" in cache)) {
        // TODO: figure out a more portable way of finding the Wasm file.
        options.locateFile = (x) => import.meta.url.substring(7) + "/../../build/" + x;

        // TODO: add bindings to set the number of threads.
        // TODO: figure out how to add the thing for service workers.
        cache.module = await loadScran(options);
    }

    return;
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

export function terminate() {
    cache.module.PThread.terminateAllThreads();
    delete cache.module;
    return;
}
