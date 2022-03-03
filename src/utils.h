#ifndef UTILS_H
#define UTILS_H

#include <vector>
#include <cstdint>
#include <cmath>

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

/**
 * Create a vector of pointers to the "columns" of matrices inside a 3-dimensional array.
 * The first two dimensions are assumed to represent the matrices of interest,
 * while the third dimension is most commonly used as a blocking factor.
 * 
 * @tparam T Type of the pointers to cast.
 *
 * @param ptr Offset to the start of a 3D array of values of the type pointed to by `T`.
 * The first dimension should be the fastest-changing, followed by the second; the last dimension should be slowest.
 * @param nr Number of rows in the array.
 * @param nc Number of column in the array.
 * @param nb Number of blocks in the array.
 *
 * @return A vector of vector of pointers.
 * Each internal vector corresponds to the 2D matrix inside the 3D array,
 * while each pointer points to each column inside each matrix.
 */
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

/**
 * Create a vector of pointers from an offset into an array of offsets.
 * This assumes that the offsets are represented as 64-bit unsigned integers on the Wasm heap.
 * 
 * @tparam Type of pointer to create.
 * @param n Length of the array of offsets.
 * @param x Offset to the array of offsets.
 *
 * @return Vector containing pointers of the desired type.
 */
template<typename T>
std::vector<T> convert_array_of_offsets(size_t n, uintptr_t x) {
    std::vector<T> output(n);
    auto ptr = reinterpret_cast<const uint64_t*>(x); // using 64-bit offsets for future-proofing.
    for (size_t i = 0; i < n; ++i) {
        uintptr_t current = ptr[i];
        output[i] = reinterpret_cast<T>(current);
    }
    return output;
}

#endif
