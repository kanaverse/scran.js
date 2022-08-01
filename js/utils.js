import { buffer, wasmArraySpace, maximumThreads } from "./wasm.js";
import * as wa from "wasmarrays.js";

/**
 * Helper function to create a Uint8WasmArray from the **wasmarrays.js** package.
 *
 * @param {number} length - Length of the array.
 *
 * @return {Uint8WasmArray} Uint8WasmArray on the **scran.js** Wasm heap.
 */
export function createUint8WasmArray(length) {
    return wa.createUint8WasmArray(wasmArraySpace(), length);
}

/**
 * Helper function to create a Int32WasmArray from the **wasmarrays.js** package.
 *
 * @param {number} length - Length of the array.
 *
 * @return {Int32WasmArray} Int32WasmArray on the **scran.js** Wasm heap.
 */
export function createInt32WasmArray(length) {
    return wa.createInt32WasmArray(wasmArraySpace(), length);
}

/**
 * Helper function to create a BigUint64WasmArray from the **wasmarrays.js** package.
 *
 * @param {number} length - Length of the array.
 *
 * @return {BigUint64WasmArray} BigUint64WasmArray on the **scran.js** Wasm heap.
 */
export function createBigUint64WasmArray (length) {
    return wa.createBigUint64WasmArray(wasmArraySpace(), length);
}

/**
 * Helper function to create a Float64WasmArray from the **wasmarrays.js** package.
 *
 * @param {number} length - Length of the array.
 *
 * @return {Float64WasmArray} Float64WasmArray on the **scran.js** Wasm heap.
 */
export function createFloat64WasmArray(length) {
    return wa.createFloat64WasmArray(wasmArraySpace(), length);
}

export function wasmifyArray(x, expected) {
    if (x instanceof wa.WasmArray) {
        if (expected !== null && expected != x.constructor.className) {
            throw new Error("expected '" + expected + "', got '" + x.constructor.className + "'");
        }

        if (x.space === wasmArraySpace()) {
            // Creating a view. This ensures that callers can always call
            // free() on the output of this function without worrying about
            // whether they are breaking something else that was using 'x'.
            if (x.owner === null) {
                return x.view();
            } else {
                return x; // it's already a view, so we just pass it along.
            }
        } else {
            // If it's a different space, then we have to make a copy.
            return x.clone(wasmArraySpace());
        }
    }

    let y = null;
    if (expected !== null) {
        y = wa.convertToWasmArray(wasmArraySpace(), x, wa.stringToClass(expected));
    } else {
        y = wa.convertToWasmArray(wasmArraySpace(), x);
    }

    return y;
}

export function chooseNumberOfThreads(threads) {
    if (threads == null) {
        return maximumThreads();
    } else {
        return threads;
    }
}

/**
 * Try to free a **scran.js** object's memory (typically involving some memory allocated on the Wasm heap) by calling its `free` method.
 *
 * @param {?object} x - Instance of a **scran.js** or **wasmarrays.js** class to be freed.
 * May also be `null` or undefined.
 * 
 * @return The output of `x.free()` - unless `x` is undefined or `null`, in which case nothing is performed.
 */
export function free(x) {
    if (typeof x == "undefined" || x == null) {
        return;
    }
    return x.free();
}

// Exported for back-compatibility, deprecated as of 0.3.0.
export function safeFree(x) {
    return free(x);
}

export function extractXY(ncells, coordinates) {
    let x = new Float64Array(ncells);
    let y = new Float64Array(ncells);

    for (var i = 0; i < ncells; i++) {
        x[i] = coordinates[2 * i];
        y[i] = coordinates[2 * i + 1];
    }

    return { "x": x, "y": y };
}

/**
 * Possibly copy an array out of the Wasm heap, avoiding potential invalidation at the cost of some efficiency.
 *
 * @param {TypedArray} x - Array of data, possibly on the **scran.js** Wasm heap.
 * @param {(string|boolean)} copy - Copying mode to use.
 *
 * @return {TypedArray|WasmArray} The return value depends on the value of `copy`:
 * - If `copy = true`, a TypedArray copy of `x` is created with `x.slice()` and returned.
 *   This is a good default to avoid invalidation of TypedArray views on the heap upon reallocation, by creating a Javascript-owned copy for downstream use.
 * - If `copy = false`, `x` is returned directly.
 *   This avoids making any copy but runs the risk of invalidation when the Wasm heap is resized;
 *   it should only be used when no further Wasm allocations are performed within the lifetime of `x`.
 * - If `copy = "view"`, a WasmArray view is created from `x` and returned.
 *   This avoids any copy and is robust to invalidation but requires an extra `WasmArray.array()` call to create a TypedArray.
 */
export function possibleCopy(x, copy) {
    if (copy === "view") {
        if (x.buffer !== buffer()) {
            throw new Error("cannot use copy = \"view\" for non-Wasm TypedArrays");
        }

        let view_class = x.constructor.name.replace("Array", "WasmArray");

        // This function should only be used for objects generated in the
        // buffer owned by scran.js, so we can assume that x's space is the
        // same as that of the wasmArraySpace().
        return wa.createWasmArrayView(wasmArraySpace(), x.length, x.byteOffset, wa.stringToClass(view_class));

    } else if (copy) {
        return x.slice();

    } else {
        return x;
    }
}

export function matchOptions(name, value, choices) {
    if (choices.indexOf(value) == -1) {
        throw new Error("'" + name + "=' should be one of '" + choices.join("', '") + "'");
    }
}
