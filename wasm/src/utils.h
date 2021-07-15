#ifndef UTILS_H
#define UTILS_H

#include <vector>
#include <cstdint>

/**
 * Create a vector of pointers based on the WASM heap offsets.
 * 
 * @tparam T Type of the pointers to cast the offsets to.
 *
 * @param ptr Offset to the start of a unsigned 32-bit integer array.
 * Each integer is itself assumed to be an offset to another array of type `T`.
 * @param n Number of integers in the array referenced by `ptr`.
 *
 * @return A `std::vector<T>` of length `n`, containing pointers to various arrays.
 */
template<typename T>
inline std::vector<T> cast_vector_of_pointers(uintptr_t ptr, size_t n) {
    std::vector<T> store(n);
    if (n) {
        uint32_t* ptrs = reinterpret_cast<uint32_t*>(ptr);
        for (size_t i = 0; i < n; ++i) {
            store[i] = reinterpret_cast<T>(static_cast<uintptr_t>(ptrs[i]));
        }
    }
    return store;
}

#endif
