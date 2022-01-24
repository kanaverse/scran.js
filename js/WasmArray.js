import * as wasm from "./wasm.js";

/** 
 * Manage an array allocated on the Wasm heap.
 * This wraps the Wasm `_malloc` and `free` commands and provides a simple method to obtain a `TypedArray` view.
 */
export class WasmArray {
    /**
     * Create an allocation on the Wasm heap.
     *
     * @param {number} length Length of the array in terms of the number of elements.
     * @param {number} offset Offset from the start of the Wasm heap.
     * If supplied, we create a view on the specified memory allocation, but do not assume ownership.
     * If undefined or `null`, the constructor will allocate the required memory from the heap and assume ownership.
     * @param {number} size Size of the data type, usually one of 1, 2, 4 or 8.
     */
    constructor(length, offset, size) {
        if (typeof offset === "undefined" || offset === null) {
            this.owner = true;
            this.offset = wasm.call(module => module._malloc(size * length));
        } else {
            this.owner = false;
            this.offset = offset;
        }
        this.length = length;
    }
   
    /**
     * Fill the array with a constant number.
     *
     * @param {number} x - Number to use to fill the array.
     * @param {number} [start] Position on the array to start filling.
     * Defaults to the start of the array.
     * @param {number} [end] Position on the array to stop filling.
     * Defaults to the end of the array.
     * Only used if `start` is specified.
     *
     * @return The array (or its specified subinterval) is filled with values from `x`.
     */
    fill(x, start, end) {
        if (typeof start === "undefined") {
            this.array().fill(x);
        } else if (typeof end === "undefined") {
            this.array().fill(x, start);
        } else {
            this.array().fill(x, start, end);
        }
        return;
    }

    /**
     * Set the array elements to the contents of an existing array.
     *
     * @param {(Array|TypedArray)} x - Source array containing the values to fill the current array.
     * @param {?number} [offset] - Position on this array to start setting to `x`.
     * Defaults to the start of the array.
     *
     * @return Entries of this array (starting from `offset`, if specified) are set to `x`.
     */
    set(x, offset) {
        if (typeof offset === "undefined") {
            this.array().set(x);
        } else {
            this.array().set(x, offset);
        }
        return;
    }

    /**
     * Create a `TypedArray` slice of the data in the allocated array.
     *
     * @param {number} [start] - Position on this array to start slicing.
     * Defaults to the start of the array.
     * @param {number} [end] - Position on the array to end slicing.
     * Defaults to the end of the array.
     * Only used if `start` is specified.
     *
     * @return A `TypedArray` containing the specified subarray.
     * This is not a view on the Wasm heap and thus can continue to be used after Wasm allocations.
     */
    slice(start, end) {
        if (typeof start === "undefined") {
            return this.array().slice();
        } else if (typeof end === "undefined") {
            return this.array().slice(start);
        } else {
            return this.array().slice(start, end);
        }
    }

    /**
     * Create a new `WasmArray` containing a copy of the data in this object.
     *
     * @return A copy of the data in a new `WasmArray`.
     *
     * Use `slice()` instead if you want to obtain a copy in a new `TypedArray`.
     */
    clone() {
        let copy = new this.constructor(this.length);
        copy.set(this.array());
        return copy;
    }

    /**
     * Free the allocated Wasm memory if this object owns that memory.
     * If an offset was provided in the constructor, this is a no-op.
     *
     * @return If this object is the owner, memory is freed and this allocation is invalidated.
     */
    free() {
        if (this.owner) {
            wasm.call(module => module._free(this.offset));
            this.offset = null;
        }
    }
}

/** 
 * Manage an unsigned 8-bit array allocated on the Wasm heap.
 *
 * @augments WasmArray
 */
export class Uint8WasmArray extends WasmArray {
    /**
     * Create an unsigned 8-bit array on the Wasm heap.
     *
     * @param {number} length - Number of elements to allocate.
     * @param {number} [offset] - Offset from the start of the Wasm heap, for an existing allocated array.
     * If not provided, the constructor will allocate the required memory.
     */ 
    constructor(length, offset) {
        super(length, offset, 1);
        return;
    }

    /**
     * @return A `Uint8Array` view of the allocated memory.
     */
    array() {
        return new Uint8Array(wasm.buffer(), this.offset, this.length);
    }

    /**
     * Name of the class.
     */
    static name = "Uint8WasmArray";
    // We're returning the name explicitly here instead of relying
    // on the constructor.name trick, as the name of the class can
    // change during minification.
}

/** 
 * Manage a signed 8-bit array allocated on the Wasm heap.
 *
 * @augments WasmArray
 */
export class Int8WasmArray extends WasmArray {
    /**
     * Create a signed 8-bit array on the Wasm heap.
     *
     * @param {number} length - Number of elements to allocate.
     * @param {number} [offset] - Offset from the start of the Wasm heap, for an existing allocated array.
     * If not provided, the constructor will allocate the required memory.
     */ 
    constructor(length, offset) {
        super(length, offset, 1);
        return;
    }

    /**
     * @return A `Int8Array` view of the allocated memory.
     */
    array() {
        return new Int8Array(wasm.buffer(), this.offset, this.length);
    }

    /**
     * Name of the class.
     */
    static name = "Int8WasmArray";
}

/** 
 * Manage an unsigned 16-bit array allocated on the Wasm heap.
 *
 * @augments WasmArray
 */
export class Uint16WasmArray extends WasmArray {
    /**
     * Create an unsigned 16-bit array on the Wasm heap.
     *
     * @param {number} length - Number of elements to allocate.
     * @param {number} [offset] - Offset from the start of the Wasm heap, for an existing allocated array.
     * If not provided, the constructor will allocate the required memory.
     */ 
    constructor(length, offset) { 
        super(length, offset, 2);
        return;
    }

    /**
     * @return A `Uint16Array` view of the allocated memory.
     */
    array() {
        return new Uint16Array(wasm.buffer(), this.offset, this.length);
    }

    /**
     * Name of the class.
     */
    static name = "Uint16WasmArray";
}

/** 
 * Manage a signed 16-bit array allocated on the Wasm heap.
 *
 * @augments WasmArray
 */
export class Int16WasmArray extends WasmArray {
    /**
     * Create a signed 16-bit array on the Wasm heap.
     *
     * @param {number} length - Number of elements to allocate.
     * @param {number} [offset] - Offset from the start of the Wasm heap, for an existing allocated array.
     * If not provided, the constructor will allocate the required memory.
     */ 
    constructor(length, offset) {
        super(length, offset, 2);
        return;
    }

    /**
     * @return A `Int16Array` view of the allocated memory.
     */
    array() {
        return new Int16Array(wasm.buffer(), this.offset, this.length);
    }

    /**
     * Name of the class.
     */
    static name = "Int16WasmArray";
}

/** 
 * Manage an unsigned 32-bit array allocated on the Wasm heap.
 */
export class Uint32WasmArray extends WasmArray {
    /**
     * Create an unsigned 32-bit array on the Wasm heap.
     *
     * @param {number} length - Number of elements to allocate.
     * @param {number} [offset] - Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset) {
        super(length, offset, 4);
        return;
    }

    /**
     * @return A `Uint32Array` view of the allocated memory.
     */
    array() {
        return new Uint32Array(wasm.buffer(), this.offset, this.length);
    }

    /**
     * Name of the class.
     */
    static name = "Uint32WasmArray";
}

/** 
 * Manage a signed 32-bit array allocated on the Wasm heap.
 *
 * @augments WasmArray
 */
export class Int32WasmArray extends WasmArray {
    /**
     * Create a signed 32-bit array on the Wasm heap.
     *
     * @param {number} length - Number of elements to allocate.
     * @param {number} [offset] - Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset) {
        super(length, offset, 4);
        return;
    }

    /**
     * @return A `Int32Array` view of the allocated memory.
     */
    array() {
        return new Int32Array(wasm.buffer(), this.offset, this.length);
    }

    /**
     * @return Name of the class.
     */
    static name = "Int32WasmArray";
}

/** 
 * Manage a 32-bit float array allocated on the Wasm heap.
 *
 * @augments WasmArray
 */
export class Float32WasmArray extends WasmArray {
    /**
     * Create a 32-bit float array on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} [offset] - Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset) {
        super(length, offset, 4);
        return;
    }

    /**
     * @return A `Float32Array` view of the allocated memory.
     */
    array() {
        return new Float32Array(wasm.buffer(), this.offset, this.length);
    }

    /**
     * @return Name of the class.
     */
    static name = "Float32WasmArray";
}

/** 
 * Manage a 64-bit float array allocated on the Wasm heap.
 *
 * @augments WasmArray
 */
export class Float64WasmArray extends WasmArray {
    /**
     * Create a 64-bit float array on the Wasm heap.
     *
     * @param {number} length - Number of elements to allocate.
     * @param {number} [offset] - Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset) {
        super(length, offset, 8);
        return;
    }

    /**
     * @return A `Float64Array` view of the allocated memory.
     */
    array() {
        return new Float64Array(wasm.buffer(), this.offset, this.length);
    }

    /**
     * @return Name of the class.
     */
    static name = "Float64WasmArray";
}
