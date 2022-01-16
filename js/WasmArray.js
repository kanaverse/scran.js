import Module from "./Module.js";

/** 
 * Manage an array allocation on the Wasm heap.
 * This wraps the Wasm `_malloc` and `free` commands and provides a simple method to obtain a `TypedArray` view.
 */
export class WasmArray {
    /**
     * Create an allocation on the Wasm heap.
     *
     * @param {number} size Length of the array in terms of the number of elements.
     * @param {number} type Size of the data type, usually one of 1, 2, 4 or 8.
     */
    constructor(size, type) {
        this.ptr = Module._malloc(size * type);
        this.size = size;
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

/** 
 * Manage an unsigned 8-bit array allocation on the Wasm heap.
 */
export class Uint8WasmArray extends WasmArray {
    /**
     * Create an unsigned 8-bit allocation on the Wasm heap.
     *
     * @param {number} size Number of elements to allocate.
     */ 
    constructor(size) {
        super(size, 1);
        return;
    }

    /**
     * @return A `Uint8Array` view of the allocated memory.
     */
    array() {
        const buffer = Module["HEAPU8"].buffer;
        return new Uint8Array(buffer, this.ptr, this.size);
    }
}

/** 
 * Manage a signed 8-bit array allocation on the Wasm heap.
 */
export class Int8WasmArray extends WasmArray {
    /**
     * Create a signed 8-bit allocation on the Wasm heap.
     *
     * @param {number} size Number of elements to allocate.
     */ 
    constructor(size) {
        super(size, 1);
        return;
    }

    /**
     * @return A `Int8Array` view of the allocated memory.
     */
    array() {
        const buffer = Module["HEAP8"].buffer;
        return new Int8Array(buffer, this.ptr, this.size);
    }
}

/** 
 * Manage an unsigned 16-bit array allocation on the Wasm heap.
 */
export class Uint16WasmArray extends WasmArray {
    /**
     * Create an unsigned 16-bit allocation on the Wasm heap.
     *
     * @param {number} size Number of elements to allocate.
     */ 
    constructor(size) {
        super(size, 2);
        return;
    }

    /**
     * @return A `Uint16Array` view of the allocated memory.
     */
    array() {
        const buffer = Module["HEAPU16"].buffer;
        return new Uint16Array(buffer, this.ptr, this.size);
    }
}

/** 
 * Manage a signed 16-bit array allocation on the Wasm heap.
 */
export class Int16WasmArray extends WasmArray {
    /**
     * Create a signed 16-bit allocation on the Wasm heap.
     *
     * @param {number} size Number of elements to allocate.
     */ 
    constructor(size) {
        super(size, 2);
        return;
    }

    /**
     * @return A `Int16Array` view of the allocated memory.
     */
    array() {
        const buffer = Module["HEAP16"].buffer;
        return new Int16Array(buffer, this.ptr, this.size);
    }
}

/** 
 * Manage an unsigned 32-bit array allocation on the Wasm heap.
 */
export class Uint32WasmArray extends WasmArray {
    /**
     * Create an unsigned 32-bit allocation on the Wasm heap.
     *
     * @param {number} size Number of elements to allocate.
     */ 
    constructor(size) {
        super(size, 4);
        return;
    }

    /**
     * @return A `Uint32Array` view of the allocated memory.
     */
    array() {
        const buffer = Module["HEAPU32"].buffer;
        return new Uint32Array(buffer, this.ptr, this.size);
    }
}

/** 
 * Manage a signed 32-bit array allocation on the Wasm heap.
 */
export class Int32WasmArray extends WasmArray {
    /**
     * Create a signed 32-bit allocation on the Wasm heap.
     *
     * @param {number} size Number of elements to allocate.
     */ 
    constructor(size) {
        super(size, 4);
        return;
    }

    /**
     * @return A `Int32Array` view of the allocated memory.
     */
    array() {
        const buffer = Module["HEAP32"].buffer;
        return new Int32Array(buffer, this.ptr, this.size);
    }
}

/** 
 * Manage a 32-bit float array allocation on the Wasm heap.
 */
export class Float32WasmArray extends WasmArray {
    /**
     * Create a 32-bit float allocation on the Wasm heap.
     *
     * @param {number} size Number of elements to allocate.
     */ 
    constructor(size) {
        super(size, 4);
        return;
    }

    /**
     * @return A `Float32Array` view of the allocated memory.
     */
    array() {
        const buffer = Module["HEAPF32"].buffer;
        return new Float32Array(buffer, this.ptr, this.size);
    }
}

/** 
 * Manage a 64-bit float array allocation on the Wasm heap.
 */
export class Float64WasmArray extends WasmArray {
    /**
     * Create a 64-bit float allocation on the Wasm heap.
     *
     * @param {number} size Number of elements to allocate.
     */ 
    constructor(size) {
        super(size, 8);
        return;
    }

    /**
     * @return A `Float64Array` view of the allocated memory.
     */
    array() {
        const buffer = Module["HEAPF64"].buffer;
        return new Float64Array(buffer, this.ptr, this.size);
    }
}
