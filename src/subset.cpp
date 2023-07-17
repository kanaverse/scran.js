#include <emscripten/bind.h>

#include <vector>
#include <stdexcept>
#include <string>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "tatami/tatami.hpp"

void column_subset(NumericMatrix& matrix, uintptr_t offset, size_t length) {
    auto offset_ptr = reinterpret_cast<const int*>(offset);
    check_subset_indices<false>(offset_ptr, length, matrix.ncol());
    auto ptr = tatami::make_DelayedSubset<1>(matrix.ptr, std::vector<int>(offset_ptr, offset_ptr + length));
    matrix.ptr = std::move(ptr);
    return;
}

void row_subset(NumericMatrix& matrix, uintptr_t offset, size_t length) {
    auto offset_ptr = reinterpret_cast<const int*>(offset);
    check_subset_indices<true>(offset_ptr, length, matrix.nrow());
    auto ptr = tatami::make_DelayedSubset<0>(std::move(matrix.ptr), std::vector<int>(offset_ptr, offset_ptr + length));
    matrix.ptr = std::move(ptr);
    return;
}

EMSCRIPTEN_BINDINGS(column_subset) {
    emscripten::function("column_subset", &column_subset);

    emscripten::function("row_subset", &row_subset);
}
