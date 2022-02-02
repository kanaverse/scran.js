import { WasmArray, 
         Int8WasmArray,  Uint8WasmArray, 
         Int16WasmArray, Uint16WasmArray,
         Int32WasmArray, Uint32WasmArray,
         Float32WasmArray, Float64WasmArray } from "./WasmArray.js";
import { buffer } from "./wasm.js";

export function wasmifyArray(x, expected) {
    if (x instanceof WasmArray) {
        if (expected !== null && expected != x.constructor.className) {
            throw "expected '" + expected + "', got '" + x.constructor.className + "'";
        }
        if (x.owner) {
            return new x.constructor(x.length, x.offset); // when offset is supplied, this is a view.
        } else {
            return x; // it's already a view, so we just pass it along.
        }
    }

    if (expected === null) {
        if (ArrayBuffer.isView(x)) {
            expected = x.constructor.name.replace("Array", "WasmArray");
        } else {
            expected = "Float64WasmArray";
        }
    }

    let y = null;
    try {
        switch (expected) {
            case "Uint8WasmArray":
                y = new Uint8WasmArray(x.length);
                break;
            case "Int8WasmArray":
                y = new Int8WasmArray(x.length);
                break;
            case "Uint16WasmArray":
                y = new Uint16WasmArray(x.length);
                break;
            case "Int16WasmArray":
                y = new Int16WasmArray(x.length);
                break;
            case "Uint32WasmArray":
                y = new Uint32WasmArray(x.length);
                break;
            case "Int32WasmArray":
                y = new Int32WasmArray(x.length);
                break;
            case "Float32WasmArray":
                y = new Float32WasmArray(x.length);
                break;
            case "BigInt64WasmArray":
            case "BigUint64WasmArray":
            case "Float64WasmArray":
                y = new Float64WasmArray(x.length); // no HEAP64 as of time of writing.
                break;
            default:
                throw "unknown expected type '" + expected + "'";
        }

        if (ArrayBuffer.isView(x) && (x.constructor.name.startsWith("BigInt") || x.constructor.name.startsWith("BigUint"))) {
            // Needs an explicit cast.
            var v = y.array();
            x.forEach((n, i) => { v[i] = Number(n); });
        } else {
            y.set(x);
        }
    } catch(e) {
        if (y !== null) {
            y.free();
        }
        throw e;
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

        let y;
        switch (x.constructor.name) {
            case "Uint8Array":
                y = new Uint8WasmArray(x.length, x.byteOffset);
                break;
            case "Int8Array":
                y = new Int8WasmArray(x.length, x.byteOffset);
                break;
            case "Uint16Array":
                y = new Uint16WasmArray(x.length, x.byteOffset);
                break;
            case "Int16Array":
                y = new Int16WasmArray(x.length, x.byteOffset);
                break;
            case "Uint32Array":
                y = new Uint32WasmArray(x.length, x.byteOffset);
                break;
            case "Int32Array":
                y = new Int32WasmArray(x.length, x.byteOffset);
                break;
            case "Float32Array":
                y = new Float32WasmArray(x.length, x.byteOffset);
                break;
            case "Float64Array":
                y = new Float64WasmArray(x.length, x.byteOffset); 
                break;
            default:
                throw "unknown expected type '" + x.constructor.name + "'";
        }
        y.set(x);
        return y;

    } else if (copy) {
        return x.slice();

    } else {
        return x;
    }
}
