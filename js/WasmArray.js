import * as wasm from "./wasm.js";

/** 
 * Manage an array allocation on the Wasm heap.
 * This wraps the Wasm `_malloc` and `free` commands and provides a simple method to obtain a `TypedArray` view.
 */
export class WasmArray {
    /**
     * Create an allocation on the Wasm heap.
     *
     * @param {number} length Length of the array in terms of the number of elements.
     * @param {number} offset Offset from the start of the Wasm heap.
     * If supplied, we create a view on the specified memory allocation, but do not assume ownership.
     * If `null`, the constructor will allocate the required memory from the heap and assume ownership.
     * @param {number} size Size of the data type, usually one of 1, 2, 4 or 8.
     */
    constructor(length, offset, size) {
        if (offset === null) {
            this.owner = true;
            this.offset = wasm.call(module => module._malloc(size * length));
        } else {
            this.owner = false;
            this.offset = offset;
        }
        this.length = length;
    }
   
    /**
     * Fill the allocation with a number.
     *
     * @param {number} x Number to use to fill the array.
     * @param {?number} start Position on the array to start filling.
     * Defaults to the start of the array.
     * @param {?number} end Position on the array to stop filling.
     * Defaults to the end of the array.
     * Only used if `start` is specified.
     *
     * @return The allocation is filled with values from `x`.
     */
    fill(x = 0, start = null, end = null) {
        if (start === null) {
            this.array().fill(x);
        } else if (end === null) {
            this.array().fill(x, start);
        } else {
            this.array().fill(x, start, end);
        }
        return;
    }

    /**
     * Set the allocation with the contents of an existing array.
     *
     * @param {array} x An array or `TypedArray` containing the values to use for filling.
     * @param {?number} offset Position on the array allocation to start setting to `x`.
     * Defaults to the start of the array.
     *
     * @return All entries of the array allocation is set to `x`.
     */
    set(x, offset = null) {
        if (offset === null) {
            this.array().set(x);
        } else {
            this.array().set(x, offset);
        }
        return;
    }

    /**
     * Create a `TypedArray` slice of the data in the array allocation.
     *
     * @param {?number} start Position on this array to start slicing.
     * Defaults to the start of the array.
     * @param {?number} end Position on the array to end slicing.
     * Defaults to the end of the array.
     * Only used if `start` is specified.
     *
     * @return A `TypedArray` containing the specified subarray.
     * This is not a view on the Wasm heap and thus can continue to be used after Wasm allocations.
     */
    slice(start = null, end = null) {
        if (start === null) {
            return this.array().slice();
        } else if (end === null) {
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
     * Free the memory in this allocation, if the object owns that memory.
     * If an offset was provided in the constructor, this is a no-op.
     *
     * @return Memory is freed and this allocation is invalidated.
     */
    free() {
        if (this.owner) {
            wasm.call(module => module._free(this.offset));
            this.offset = null;
        }
    }
}

/** 
 * Manage an unsigned 8-bit array allocation on the Wasm heap.
 */
export class Uint8WasmArray extends WasmArray {
    /**
     * Create an unsigned 8-bit allocation on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} offset Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset = null) {
        super(length, offset, 1);
        return;
    }

    /**
     * @return A `Uint8Array` view of the allocated memory.
     */
    array() {
        return new Uint8Array(wasm.buffer(), this.offset, this.length);
    }
}

/** 
 * Manage a signed 8-bit array allocation on the Wasm heap.
 */
export class Int8WasmArray extends WasmArray {
    /**
     * Create a signed 8-bit allocation on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} offset Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset = null) {
        super(length, offset, 1);
        return;
    }

    /**
     * @return A `Int8Array` view of the allocated memory.
     */
    array() {
        return new Int8Array(wasm.buffer(), this.offset, this.length);
    }
}

/** 
 * Manage an unsigned 16-bit array allocation on the Wasm heap.
 */
export class Uint16WasmArray extends WasmArray {
    /**
     * Create an unsigned 16-bit allocation on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} offset Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset = null) {
        super(length, offset, 2);
        return;
    }

    /**
     * @return A `Uint16Array` view of the allocated memory.
     */
    array() {
        return new Uint16Array(wasm.buffer(), this.offset, this.length);
    }
}

/** 
 * Manage a signed 16-bit array allocation on the Wasm heap.
 */
export class Int16WasmArray extends WasmArray {
    /**
     * Create a signed 16-bit allocation on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} offset Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset = null) {
        super(length, offset, 2);
        return;
    }

    /**
     * @return A `Int16Array` view of the allocated memory.
     */
    array() {
        return new Int16Array(wasm.buffer(), this.offset, this.length);
    }
}

/** 
 * Manage an unsigned 32-bit array allocation on the Wasm heap.
 */
export class Uint32WasmArray extends WasmArray {
    /**
     * Create an unsigned 32-bit allocation on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} offset Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset = null) {
        super(length, offset, 4);
        return;
    }

    /**
     * @return A `Uint32Array` view of the allocated memory.
     */
    array() {
        return new Uint32Array(wasm.buffer(), this.offset, this.length);
    }
}

/** 
 * Manage a signed 32-bit array allocation on the Wasm heap.
 */
export class Int32WasmArray extends WasmArray {
    /**
     * Create a signed 32-bit allocation on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} offset Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset = null) {
        super(length, offset, 4);
        return;
    }

    /**
     * @return A `Int32Array` view of the allocated memory.
     */
    array() {
        return new Int32Array(wasm.buffer(), this.offset, this.length);
    }
}

/** 
 * Manage a 32-bit float array allocation on the Wasm heap.
 */
export class Float32WasmArray extends WasmArray {
    /**
     * Create a 32-bit float allocation on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} offset Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset = null) {
        super(length, offset, 4);
        return;
    }

    /**
     * @return A `Float32Array` view of the allocated memory.
     */
    array() {
        return new Float32Array(wasm.buffer(), this.offset, this.length);
    }
}

/** 
 * Manage a 64-bit float array allocation on the Wasm heap.
 */
export class Float64WasmArray extends WasmArray {
    /**
     * Create a 64-bit float allocation on the Wasm heap.
     *
     * @param {number} length Number of elements to allocate.
     * @param {number} offset Offset from the start of the Wasm heap, for an existing allocated array.
     * If `null`, the constructor will allocate the required memory.
     */ 
    constructor(length, offset = null) {
        super(length, offset, 8);
        return;
    }

    /**
     * @return A `Float64Array` view of the allocated memory.
     */
    array() {
        return new Float64Array(wasm.buffer(), this.offset, this.length);
    }
}
