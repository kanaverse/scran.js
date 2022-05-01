#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran/normalization/GroupedSizeFactors.hpp"

#include <vector>

/**
 * Compute group-based size factors to remove composition biases in sparse data.
 *
 * @param mat A `NumericMatrix` object containing features in rows and cells in columns.
 * @param[in] groups Offset to an integer array of length equal to the number of columns in `mat`, specifying the group assignment for each cell.
 * Group IDs should be consecutive and 0-based.
 * If `false`, an average pseudo-cell is constructed from `mat` and used as the reference.
 * @param center Whether to center the size factors so that the average is set to unity.
 * If `false`, the size factors can be interpreted as the scaling to `ref`.
 * @param prior_count Prior count to use for shrinking size factors towards the relative library size.
 * Larger values result in stronger shrinkage when the coverage is low.
 * @param {?number} reference Group to use as a reference.
 * This should be an entry in the array pointed to by `groups`. 
 * @param[out] output Offset to a double-precision array of length equal to the number of cells in `mat`,
 * to store the size factor for each cell.
 * 
 * @return `output` is filled with the size factors for all cells in `mat`.
 */
void grouped_size_factors(const NumericMatrix& mat, uintptr_t groups, bool center, double prior_count, int reference, uintptr_t output) {
    scran::GroupedSizeFactors runner;
    runner.set_center(center).set_prior_count(prior_count); 

    auto gptr = reinterpret_cast<const int*>(groups);
    auto optr = reinterpret_cast<double*>(output);

    if (reference >= 0) {
        runner.run(mat.ptr.get(), gptr, reference, optr);
    } else {
        runner.run(mat.ptr.get(), gptr, optr);
    }
    return;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(grouped_size_factors) {
    emscripten::function("grouped_size_factors", &grouped_size_factors);
}
/**
 * @endcond
 */
