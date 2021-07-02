#ifndef UTILS_H
#define UTILS_H

#include <vector>
#include <cstdint>

template<typename T>
std::vector<T> cast_vector_of_pointers(uintptr_t ptr, size_t n) {
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
