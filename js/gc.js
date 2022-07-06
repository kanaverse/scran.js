import * as wasm from "./wasm.js";

const memories = {};
let counter = 0;

export function release(id) {
    if (id in memories) {
        memories[id].delete();
        delete memories[id];
    }
    return;
}

const finalizer = new FinalizationRegistry(release);

export function wrap(raw, constructor, ...other){
    let id = counter;
    memories[id] = raw; 
    counter++;
    return new constructor(id, raw, ...other);
}

export function call(fun, constructor, ...other) {
    let raw = wasm.call(fun);

    let id = counter;
    memories[id] = raw; 
    counter++;
    
    let output;
    try {
        output = new constructor(id, raw, ...other);
    } catch (e) {
        release(id);
        throw e;
    }

    return output;
}


