#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/normalization/LogNormCounts.hpp"

#include <vector>
#include <cstdint>

NumericMatrix log_norm_counts(const NumericMatrix& mat, 
    bool use_size_factors,
    uintptr_t size_factors,
    bool use_blocks, 
    uintptr_t blocks,
    bool allow_zero)
{
    scran::LogNormCounts norm;
    norm.set_handle_zeros(allow_zero);
    
    std::vector<double> sf;
    if (use_size_factors) {
        const double* sfptr = reinterpret_cast<const double*>(size_factors);
        sf.insert(sf.end(), sfptr, sfptr + mat.ncol());
    } else {
        sf = tatami::column_sums(mat.ptr.get());
    }

    if (use_blocks) {
        return NumericMatrix(norm.run_blocked(mat.ptr, std::move(sf), reinterpret_cast<const int32_t*>(blocks)), mat.row_ids);
    } else {
        return NumericMatrix(norm.run(mat.ptr, std::move(sf)), mat.row_ids);
    }
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(log_norm_counts) {
    emscripten::function("log_norm_counts", &log_norm_counts);
}
/**
 * @endcond 
 */
