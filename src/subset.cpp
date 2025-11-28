#include <emscripten/bind.h>

#include <vector>
#include <stdexcept>
#include <string>

#include "NumericMatrix.h"
#include "utils.h"

#include "tatami/tatami.hpp"

void column_subset(NumericMatrix& matrix, JsFakeInt offset_raw, JsFakeInt length_raw) {
    const auto length = js2int<std::size_t>(length_raw);
    const auto offset = js2int<std::uintptr_t>(offset_raw);
    const auto offset_ptr = reinterpret_cast<const std::int32_t*>(offset);
    check_subset_indices<false>(offset_ptr, length, matrix.ncol());
    matrix.reset_ptr(tatami::make_DelayedSubset<MatrixValue, MatrixIndex>(matrix.ptr(), std::vector<std::int32_t>(offset_ptr, offset_ptr + length), false));
    return;
}

void row_subset(NumericMatrix& matrix, JsFakeInt offset_raw, JsFakeInt length_raw) {
    const auto length = js2int<std::size_t>(length_raw);
    const auto offset = js2int<std::uintptr_t>(offset_raw);
    const auto offset_ptr = reinterpret_cast<const std::int32_t*>(offset);
    check_subset_indices<true>(offset_ptr, length, matrix.nrow());
    matrix.reset_ptr(tatami::make_DelayedSubset<MatrixValue, MatrixIndex>(matrix.ptr(), std::vector<std::int32_t>(offset_ptr, offset_ptr + length), true));
    return;
}

EMSCRIPTEN_BINDINGS(column_subset) {
    emscripten::function("column_subset", &column_subset, emscripten::return_value_policy::take_ownership());

    emscripten::function("row_subset", &row_subset, emscripten::return_value_policy::take_ownership());
}
