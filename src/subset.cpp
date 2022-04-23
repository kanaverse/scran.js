#include <emscripten/bind.h>
#include <vector>
#include "NumericMatrix.h"
#include "tatami/tatami.hpp"
#include "utils.h"

/** 
 * @param matrix Offset to the matrix 
 * @param offset Offset to the start of the indices to slice or subset
 * All values in indices must be < `numberOfColumns()`
 * 
 * @param length length of the indices 
 *
 * This function apply's a delayed subset operation on the matrix over columns
 */
NumericMatrix column_subset(const NumericMatrix& matrix, uintptr_t offset, size_t length) {
    auto offset_ptr = reinterpret_cast<const int32_t*>(offset);
    return NumericMatrix(tatami::make_DelayedSubset<1>(matrix.ptr, std::vector<int32_t>(offset_ptr, offset_ptr+length)));
}

/** 
 * @param matrix Offset to the matrix 
 * @param offset Offset to the start of the indices to slice or subset
 * All values in indices must be < `numberOfColumns()`
 * 
 * @param length length of the indices 
 *
 * This function apply's a delayed subset operation on the matrix over rows
 */
NumericMatrix row_subset(const NumericMatrix& matrix, uintptr_t offset, size_t length) {
    auto offset_ptr = reinterpret_cast<const int32_t*>(offset);
    return NumericMatrix(tatami::make_DelayedSubset<0>(matrix.ptr, std::vector<int32_t>(offset_ptr, offset_ptr+length)));
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

