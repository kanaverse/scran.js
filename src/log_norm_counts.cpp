#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/scran.hpp"

#include <vector>
#include <cstdint>

NumericMatrix log_norm_counts(const NumericMatrix& mat, 
    bool use_size_factors,
    uintptr_t size_factors,
    bool use_blocks, 
    uintptr_t blocks,
    bool center,
    bool allow_zero,
    bool allow_non_finite)
{
    scran::LogNormCounts norm;
    norm.set_handle_zeros(allow_zero);
    norm.set_handle_non_finite(allow_non_finite);
    norm.set_center(center);
    
    std::vector<double> sf;
    if (use_size_factors) {
        const double* sfptr = reinterpret_cast<const double*>(size_factors);
        sf.insert(sf.end(), sfptr, sfptr + mat.ncol());
    } else {
        sf = tatami::column_sums(mat.ptr.get());
    }

    if (use_blocks) {
        return NumericMatrix(norm.run_blocked(mat.ptr, std::move(sf), reinterpret_cast<const int32_t*>(blocks)));
    } else {
        return NumericMatrix(norm.run(mat.ptr, std::move(sf)));
    }
}

void center_size_factors(size_t n, uintptr_t ptr, bool use_blocks, uintptr_t blocks) {
    scran::CenterSizeFactors centerer;

    if (use_blocks) {
        centerer.run_blocked(n, reinterpret_cast<double*>(ptr), reinterpret_cast<const int32_t*>(blocks));
    } else {
        centerer.run(n, reinterpret_cast<double*>(ptr));
    }

    return;
}
 
EMSCRIPTEN_BINDINGS(log_norm_counts) {
    emscripten::function("log_norm_counts", &log_norm_counts, emscripten::return_value_policy::take_ownership());
    emscripten::function("center_size_factors", &center_size_factors, emscripten::return_value_policy::take_ownership());
}
