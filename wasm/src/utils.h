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
 * Set blocking information for an instance of a function class.
 *
 * @param use_blocks Whether or not to use blocks.
 * @param blocks Offset to an array of `int32_t`s with `n` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 * If `use_blocks = false`, this value is ignored.
 * @param n Length of the array referenced by `blocks`.
 * Only used if `use_blocks = true`.
 *
 * @return A pair containing a pointer to the array of block indices, 
 * plus a vector containing a (possibly empty) buffer.
 * If `use_blocks = false`, the former will point to the address occupied by the latter,
 * which in turn will be filled with all-zero values (i.e., all elements in the same block).
 */
inline std::pair<const int32_t*, std::vector<int32_t> > add_blocks(bool use_blocks, uintptr_t blocks, size_t n) {
    std::vector<int32_t> tmp_blocks;
    const int32_t* block_ptr = NULL;
    if (!use_blocks) {
        tmp_blocks.resize(n, 0);
        block_ptr = tmp_blocks.data();
    } else {
        block_ptr = reinterpret_cast<const int32_t*>(blocks);
    }
    return std::make_pair(block_ptr, tmp_blocks);
}

#endif
