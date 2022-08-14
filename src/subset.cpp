#include <emscripten/bind.h>

#include <vector>
#include <stdexcept>
#include <string>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "tatami/tatami.hpp"

template<bool row>
void check_limit(const int* ptr, size_t len, size_t limit) {
    for (size_t i = 0; i < len; ++i) {
        if (ptr[i] < 0) {
            throw std::runtime_error("subset indices should be non-negative");
        } else if (ptr[i] >= limit) {
            throw std::runtime_error("subset indices should be less than the number of " + (row ? std::string("rows") : std::string("columns")));
        }
    }
}

void column_subset(NumericMatrix& matrix, uintptr_t offset, size_t length) {
    auto offset_ptr = reinterpret_cast<const int*>(offset);
    check_limit<false>(offset_ptr, length, matrix.ncol());
    auto ptr = tatami::make_DelayedSubset<1>(matrix.ptr, std::vector<int>(offset_ptr, offset_ptr + length));
    matrix.ptr = std::move(ptr);
    return;
}

void row_subset(NumericMatrix& matrix, uintptr_t offset, size_t length) {
    auto offset_ptr = reinterpret_cast<const int*>(offset);
    check_limit<true>(offset_ptr, length, matrix.nrow());
    auto ptr = tatami::make_DelayedSubset<0>(std::move(matrix.ptr), std::vector<int>(offset_ptr, offset_ptr + length));
    matrix.ptr = std::move(ptr);

    if (matrix.is_reorganized) {
        std::vector<size_t> remaining(length);
        for (size_t o = 0; o < length; ++o) {
            remaining[o] = matrix.row_ids[offset_ptr[o]];
        }
        matrix.row_ids = std::move(remaining);
    } else {
        matrix.is_reorganized = true;
        matrix.row_ids = std::vector<size_t>(offset_ptr, offset_ptr + length);
    }

    return;
}

EMSCRIPTEN_BINDINGS(column_subset) {
    emscripten::function("column_subset", &column_subset);

    emscripten::function("row_subset", &row_subset);
}
