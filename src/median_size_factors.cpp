#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran/normalization/MedianSizeFactors.hpp"

#include <vector>
#include <cstdint>

/**
 * Compute median-based size factors to remove composition biases.
 *
 * @param mat A `NumericMatrix` object containing features in rows and cells in columns.
 * @param use_ref Whether to use the supplied reference in `ref`.
 * If `false`, an average pseudo-cell is constructed from `mat` and used as the reference.
 * @param[in] ref Offset to a double-precision array of length equal to the number of rows in `mat`,
 * containing the reference expression profile to normalize against.
 * @param center Whether to center the size factors so that the average is set to unity.
 * If `false`, the size factors can be interpreted as the scaling to `ref`.
 * @param prior_count Prior count to use for shrinking size factors towards the relative library size.
 * Larger values result in stronger shrinkage when the coverage is low.
 * @param[out] output Offset to a double-precision array of length equal to the number of cells in `mat`,
 * to store the size factor for each cell.
 * 
 * @return `output` is filled with the size factors for all cells in `mat`.
 */
void median_size_factors(const NumericMatrix& mat, bool use_ref, uintptr_t ref, bool center, double prior_count, uintptr_t output) {
    scran::MedianSizeFactors med;
    med.set_center(center).set_prior_count(prior_count);
    auto optr = reinterpret_cast<double*>(output);

    if (!use_ref) {
        med.run_with_mean(mat.ptr.get(), optr);
    } else {
        auto rptr = reinterpret_cast<const double*>(ref);
        med.run(mat.ptr.get(), rptr, optr);
    }

    return;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(median_size_factors) {
    emscripten::function("median_size_factors", &median_size_factors);
}
/**
 * @endcond
 */
