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

/**
 * Create a vector of pointers to the columns of a matrix.
 * 
 * @tparam T Type of the pointers to cast.
 *
 * @param ptr Offset to the start of a 2D array of values of the type pointed to by `T`.
 * Array values should be stored in column-major format.
 * @param nr Number of rows in the array.
 * @param nc Number of column in the array.
 *
 * @return A vector of pointers to each column.
 */
template<typename T>
inline std::vector<T> extract_column_pointers(uintptr_t ptr, size_t nr, size_t nc) {
    std::vector<T> store(nc);
    if (nr && nc) {
        T raw = reinterpret_cast<T>(ptr);
        for (size_t i = 0; i < nc; ++i, raw += nr) {
            store[i] = raw;
        }
    }
    return store;
}

template<typename T>
inline std::vector<std::vector<T> > extract_column_pointers_blocked(uintptr_t ptr, size_t nr, size_t nc, size_t nb) {
    std::vector<std::vector<T> > store(nb, std::vector<T>(nc));
    if (nb && nr && nc) {
        T raw = reinterpret_cast<T>(ptr);
        for (size_t b = 0; b < nb; ++b) {
            for (size_t i = 0; i < nc; ++i, raw += nr) {
                store[b][i] = raw;
            }
        }
    }
    return store;
}

#endif
