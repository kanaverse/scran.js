#include <emscripten/bind.h>
#include <vector>
#include <stdexcept>
#include <string>
#include "NumericMatrix.h"
#include "tatami/tatami.hpp"
#include "utils.h"

/**
 * @cond
 */
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
/**
 * @endcond
 */

/** 
 * @param matrix A `NumericMatrix` object. 
 * @param offset Offset to a 32-bit integer array containing the column indices to subset.
 * All indices should be positive and less than the number of columns in `matrix`.
 * @param length Length of the array pointed to by `offset`.
 *
 * @return A `NumericMatrix` containing a delayed subset on the columns of `matrix`.
 */
NumericMatrix column_subset(const NumericMatrix& matrix, uintptr_t offset, size_t length) {
    auto offset_ptr = reinterpret_cast<const int*>(offset);
    check_limit<false>(offset_ptr, length, matrix.ncol());

    auto ptr = tatami::make_DelayedSubset<1>(matrix.ptr, std::vector<int>(offset_ptr, offset_ptr + length));
    if (matrix.is_reorganized) {
        return NumericMatrix(std::move(ptr), matrix.row_ids);
    } else {
        return NumericMatrix(std::move(ptr));
    }
}

/** 
 * @param matrix A `NumericMatrix` object. 
 * @param offset Offset to a 32-bit integer array containing the row indices to subset.
 * All indices should be positive and less than the number of rows in `matrix`.
 * @param length Length of the array pointed to by `offset`.
 *
 * @return A `NumericMatrix` containing a delayed subset on the columns of `matrix`.
 */
NumericMatrix row_subset(const NumericMatrix& matrix, uintptr_t offset, size_t length) {
    auto offset_ptr = reinterpret_cast<const int*>(offset);
    check_limit<true>(offset_ptr, length, matrix.nrow());

    std::vector<size_t> remaining(length);
    if (matrix.is_reorganized) {
        for (size_t o = 0; o < length; ++o) {
            remaining[o] = matrix.row_ids[offset_ptr[o]];
        }
    } else {
        std::copy(offset_ptr, offset_ptr + length, remaining.begin());
    }

    return NumericMatrix(tatami::make_DelayedSubset<0>(matrix.ptr, std::vector<int>(offset_ptr, offset_ptr + length)), std::move(remaining));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(column_subset) {
    emscripten::function("column_subset", &column_subset);

    emscripten::function("row_subset", &row_subset);
}
/**
 * @endcond
 */

