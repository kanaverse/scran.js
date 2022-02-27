import { buffer, wasmArraySpace } from "./wasm.js";
import * as wa from "WasmArray";

/**
 * Helper function to create a `Uint8WasmArray` from the **WasmArray** package.
 *
 * @param {number} length - Length of the array.
 *
 * @return A `Uint8WasmArray` on the **scran.js** Wasm heap.
 */
export function createUint8WasmArray(length) {
    return wa.createUint8WasmArray(wasmArraySpace(), length);
}

/**
 * Helper function to create a `Int32WasmArray` from the **WasmArray** package.
 *
 * @param {number} length - Length of the array.
 *
 * @return A `Int32WasmArray` on the **scran.js** Wasm heap.
 */
export function createInt32WasmArray(length) {
    return wa.createInt32WasmArray(wasmArraySpace(), length);
}

/**
 * Helper function to create a `Float64WasmArray` from the **WasmArray** package.
 *
 * @param {number} length - Length of the array.
 *
 * @return A `Float64WasmArray` on the **scran.js** Wasm heap.
 */
export function createFloat64WasmArray(length) {
    return wa.createFloat64WasmArray(wasmArraySpace(), length);
}

export function wasmifyArray(x, expected) {
    if (x instanceof wa.WasmArray) {
        if (expected !== null && expected != x.constructor.className) {
            throw "expected '" + expected + "', got '" + x.constructor.className + "'";
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
        switch (expected) {
            case "Uint8WasmArray":
                y = wa.convertToUint8WasmArray(wasmArraySpace(), x);
                break;
            case "Int8WasmArray":
                y = wa.convertToInt8WasmArray(wasmArraySpace(), x);
                break;
            case "Uint16WasmArray":
                y = wa.convertToUint16WasmArray(wasmArraySpace(), x);
                break;
            case "Int16WasmArray":
                y = wa.convertToInt16WasmArray(wasmArraySpace(), x);
                break;
            case "Uint32WasmArray":
                y = wa.convertToUint32WasmArray(wasmArraySpace(), x);
                break;
            case "Int32WasmArray":
                y = wa.convertToInt32WasmArray(wasmArraySpace(), x);
                break;
            case "Float32WasmArray":
                y = wa.convertToFloat32WasmArray(wasmArraySpace(), x);
                break;
            case "Float64WasmArray":
                y = wa.convertToFloat64WasmArray(wasmArraySpace(), x);
                break;
            default:
                throw "unknown expected type '" + expected + "'";
        }
    } else {
        y = wa.convertToWasmArray(wasmArraySpace());
    }

    return y;
}

export function free(x) {
    if (x !== null && x !== undefined) {
        if ("free" in x) {
            x.free();
        } else if ("delete" in x) {
            x.delete(); // i.e., one of the raw C++ classes.
        }
    }
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

export function possibleCopy(x, copy) {
    if (copy === "view") {
        if (x.buffer !== buffer()) {
            throw "cannot use copy = \"WasmArray\" for non-Wasm TypedArrays";
        }

        // This function should only be used for objects generated in the
        // buffer owned by scran.js, so we can assume that x's space is the
        // same as that of the wasmArraySpace().
        let y;
        switch (x.constructor.name) {
            case "Uint8Array":
                y = new wa.Uint8WasmArray(wasmArraySpace(), -1, x.length, x.byteOffset, {});
                break;
            case "Int8Array":
                y = new wa.Int8WasmArray(wasmArraySpace(), -1, x.length, x.byteOffset, {});
                break;
            case "Uint16Array":
                y = new wa.Uint16WasmArray(wasmArraySpace(), -1, x.length, x.byteOffset, {});
                break;
            case "Int16Array":
                y = new wa.Int16WasmArray(wasmArraySpace(), -1, x.length, x.byteOffset, {});
                break;
            case "Uint32Array":
                y = new wa.Uint32WasmArray(wasmArraySpace(), -1, x.length, x.byteOffset, {});
                break;
            case "Int32Array":
                y = new wa.Int32WasmArray(wasmArraySpace(), -1, x.length, x.byteOffset, {});
                break;
            case "Float32Array":
                y = new wa.Float32WasmArray(wasmArraySpace(), -1, x.length, x.byteOffset, {});
                break;
            case "Float64Array":
                y = new wa.Float64WasmArray(wasmArraySpace(), -1, x.length, x.byteOffset, {}); 
                break;
            default:
                throw "unknown expected type '" + x.constructor.name + "'";
        }

        return y;

    } else if (copy) {
        return x.slice();

    } else {
        return x;
    }
}
