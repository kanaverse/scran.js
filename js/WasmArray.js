import { Module } from "./Module.js";

/** 
 * Manage an array allocation on the Wasm heap.
 * This wraps the Wasm `_malloc` and `free` commands and provides a simple method to obtain a `TypedArray` view.
 */
export class WasmArray {
    static mapping =  {
        Float64Array: {
            size: 8,
            wasm: "HEAPF64",
        },
        Float32Array: {
            size: 4,
            wasm: "HEAPF32",
        },
        Int8Array: {
            size: 1,
            wasm: "HEAP8",
        },
        Uint8Array: {
            size: 1,
            wasm: "HEAPU8",
        },
        Int16Array: {
            size: 2,
            wasm: "HEAP16",
        },
        Uint16Array: {
            size: 2,
            wasm: "HEAPU16",
        },
        Int32Array: {
            size: 4,
            wasm: "HEAP32",
        },
        Uint32Array: {
            size: 4,
            wasm: "HEAPU32",
        },
        Int64Array: {
            size: 8,
            wasm: "HEAP64",
        },
        Uint64Array: {
            size: 8,
            wasm: "HEAPU64",
        }
    };

    /**
     * Create an allocation on the Wasm heap.
     *
     * @param {number} size Size of the array in terms of the number of elements.
     * @param {number} type Type of the array, as the name of a `TypedArray` subclass.
     */
    constructor(size, type) {
        const curtype = WasmArray.mapping[type];
        this.ptr = Module._malloc(size * curtype.size);
        this.size = size;
        this.type = type;
    }

    /** 
     * Convert a Wasm heap allocation into a `TypedArray`.
     *
     * @param {number} ptr Offset to the start of the array on the Wasm heap.
     * @param {number} size Size of the array in terms of the number of elements.
     * @param {number} type Type of the array, as the name of a `TypedArray` subclass.
     *
     * @return A `TypedArray` view of the data at the specified offset.
     *
     * We generally recommend re-obtaining the view after any Wasm allocations as these may be invalidated if the heap moves.
     */
    static toTypedArray(ptr, size, type) {
        const curtype = WasmArray.mapping[type];
        const buffer = Module[curtype["wasm"]].buffer;

        let arr;
        if (type == "Float64Array") {
            arr = new Float64Array(buffer, ptr, size);
        } else if (type == "Float32Array") {
            arr = new Float32Array(buffer, ptr, size);
        } else if (type == "Int8Array") {
            arr = new Int8Array(buffer, ptr, size);
        } else if (type == "Uint8Array") {
            arr = new Uint8Array(buffer, ptr, size);
        } else if (type == "Int16Array") {
            arr = new Int16Array(buffer, ptr, size);
        } else if (type == "Uint16Array") {
            arr = new Uint16Array(buffer, ptr, size);
        } else if (type == "Int32Array") {
            arr = new Int32Array(buffer, ptr, size);
        } else if (type == "Uint32Array") {
            arr = new Uint32Array(buffer, ptr, size);
        } else if (type == "Int64Array") {
            arr = new Int64Array(buffer, ptr, size);
        } else if (type == "Uint64Array") {
            arr = new Uint64Array(buffer, ptr, size);
        }

        return arr;
    }
    
    /** 
     * Obtain a `TypedArray` view on the current allocation.
     *
     * @return A `TypedArray` view of the data in this allocation.
     *
     * We generally recommend re-obtaining the view after any Wasm allocations as these may be invalidated if the heap moves.
     */
    array() {
        const ptr = this.ptr;
        if (ptr === null) {
            throw "cannot create TypedArray from a null pointer";
        }
        return WasmArray.toTypedArray(ptr, this.size, this.type);
    }

    /**
     * Fill the allocation with the contents of an existing array.
     *
     * @param {array} x An array or `TypedArray` containing the values to use for filling.
     *
     * @return The allocation is filled with values from `x`.
     */
    fill(x) {
        this.array().fill(x);
        return;
    }

    /**
     * Set all values of the allocation to a number.
     *
     * @param {number} x Number fo use to set the values of the array.
     *
     * @return All entries of the array allocation is set to `x`.
     */
    set(x = 0) {
        this.array().set(x);
        return;
    }

    /**
     * Create a `TypedArray` copy of the data in the array allocation.
     *
     * @return A copy of the data in a new `TypedArray`.
     * This is not a view on the Wasm heap and thus can continue to be used after Wasm allocations.
     */
    clone() {
        return this.array().slice();
    }

    /**
     * Free the memory in this allocation.
     *
     * @return Memory is freed and this allocation is invalidated.
     */
    free() {
        Module._free(this.ptr);
        this.ptr = null;
    }
}

export default WasmArray;
