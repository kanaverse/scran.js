import Module from "./Module.js";
import * as wa from "./WasmArray.js";

export function wrapModuleCall(fun) {
    var output;
    try {
        output = fun();
    } catch (e) {
        if (e instanceof Number) {
            throw Module.get_error_message(e);
        } else {
            throw e;
        }
    }
    return output;
}

export function wasmifyArray(x, expected = null) {
    if (x instanceof wa.WasmArray) {
        return new x.constructor(x.length, x.offset); // when offset is supplied, this is a view.
    }

    if (expected == null) {
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
                y = new wa.Uint8WasmArray(x.length);
                break;
            case "Int8WasmArray":
                y = new wa.Int8WasmArray(x.length);
                break;
            case "Uint16WasmArray":
                y = new wa.Uint16WasmArray(x.length);
                break;
            case "Int16WasmArray":
                y = new wa.Int16WasmArray(x.length);
                break;
            case "Uint32WasmArray":
                y = new wa.Uint32WasmArray(x.length);
                break;
            case "Int32WasmArray":
                y = new wa.Int32WasmArray(x.length);
                break;
            case "Float32WasmArray":
                y = new wa.Float32WasmArray(x.length);
                break;
            case "BigInt64WasmArray":
            case "BigUint64WasmArray":
            case "Float64WasmArray":
                y = new wa.Float64WasmArray(x.length); // no HEAP64 as of time of writing.
                break;
            default:
                throw "unknown expected type '" + expected + "'";
        }

        if (expected.startsWith("BigInt") || expected.startsWith("BigUint")) {
            // Needs an explicit cast.
            var v = y.array();
            expected.forEach((x, i) => { v[i] = Number(x) });
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
        if (x instanceof wa.WasmArray) {
            x.free();
        } else {
            x.delete(); // i.e., one of the raw C++ classes.
        }
    }
}