#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran_norm/scran_norm.hpp"
#include "tatami_stats/tatami_stats.hpp"

#include <vector>
#include <cstdint>

void center_size_factors(size_t n, uintptr_t ptr, bool use_blocks, uintptr_t blocks, bool to_lowest_block) {
    scran_norm::CenterSizeFactorsOptions opt;
    if (use_blocks) {
        opt.block_mode = (to_lowest_block ? scran_norm::CenterBlockMode::LOWEST : scran_norm::CenterBlockMode::PER_BLOCK);
        scran_norm::center_size_factors_blocked(n, reinterpret_cast<double*>(ptr), reinterpret_cast<const int32_t*>(blocks), NULL, opt);
    } else {
        scran_norm::center_size_factors(n, reinterpret_cast<double*>(ptr), NULL, opt);
    }
}

NumericMatrix normalize_counts(const NumericMatrix& mat, uintptr_t size_factors, bool log, bool allow_zero, bool allow_non_finite) {
    const double* sfptr = reinterpret_cast<const double*>(size_factors);
    std::vector<double> sf(sfptr, sfptr + mat.ncol());

    scran_norm::SanitizeSizeFactorsOptions san_opt;
    if (allow_zero) {
        san_opt.handle_zero = scran_norm::SanitizeAction::SANITIZE;
    }
    if (allow_non_finite) {
        san_opt.handle_nan = scran_norm::SanitizeAction::SANITIZE;
        san_opt.handle_infinite = scran_norm::SanitizeAction::SANITIZE;
    }
    scran_norm::sanitize_size_factors(sf.size(), sf.data(), san_opt);

    scran_norm::NormalizeCountsOptions norm_opt;
    norm_opt.log = log;
    return NumericMatrix(scran_norm::normalize_counts(mat.ptr, std::move(sf), norm_opt));
}

EMSCRIPTEN_BINDINGS(normalize_counts) {
    emscripten::function("center_size_factors", &center_size_factors, emscripten::return_value_policy::take_ownership());
    emscripten::function("normalize_counts", &normalize_counts, emscripten::return_value_policy::take_ownership());
}
