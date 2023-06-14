#ifndef UTILS_H
#define UTILS_H

#include <vector>
#include <cstdint>
#include <cmath>
#include <iostream>

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

template<bool row>
void check_subset_indices(const int* ptr, size_t len, size_t limit) {
    for (size_t i = 0; i < len; ++i) {
        if (ptr[i] < 0) {
            throw std::runtime_error("subset indices should be non-negative");
        } else if (ptr[i] >= limit) {
            throw std::runtime_error("subset indices should be less than the number of " + (row ? std::string("rows") : std::string("columns")));
        }
    }
}

#endif
