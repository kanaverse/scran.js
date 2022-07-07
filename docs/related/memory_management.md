# Manual memory management

Several objects returned by **scran.js** functions (any `*Results`, the `ScranMatrix`) contain allocations on the Wasm heap.
These allocations will be automatically freed when the object is garbage-collected via callbacks in the `FinalizationRegistry`.
Thus, strictly speaking, it is not necessary to `free()` them manually to release the heap memory.

That said, high-performance applications will benefit from manual `free()` once the object is no longer needed.
The Javascript garbage collector is not guaranteed to run in a predictable manner and may not release memory in the most efficient manner.
Calling `free()` directly will avoid any performance fluctuations due to untimely garbage collection.

We often use the `try`/`finally` pattern below to free memory on an object as soon as it is not needed.
This avoids memory leaks when the functions throw an error before the final result is obtained.
The `scran.free()` function will free any allocated object and skip `null` or undefined values.

```js
// The result of interest, not on the Wasm heap.
let result;

{
    // Temporary object that needs to be freed.
    let temp_obj;

    try {
        temp_obj = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);

        // Do something to get the result of interest.
        result = temp_obj.row(10);
    } finally {
        scran.free(temp_obj);
    }
}

// Continue work with 'result'.
```
