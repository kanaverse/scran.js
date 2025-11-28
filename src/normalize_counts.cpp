#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran_norm/scran_norm.hpp"
#include "tatami_stats/tatami_stats.hpp"

#include <vector>
#include <cstdint>

void js_center_size_factors(JsFakeInt n_raw, JsFakeInt ptr_raw, bool use_blocks, JsFakeInt blocks_raw, bool to_lowest_block) {
    const auto n = js2int<std::size_t>(n_raw);
    const auto ptr = reinterpret_cast<double*>(js2int<std::uintptr_t>(ptr_raw));

    scran_norm::CenterSizeFactorsOptions opt;
    if (use_blocks) {
        opt.block_mode = (to_lowest_block ? scran_norm::CenterBlockMode::LOWEST : scran_norm::CenterBlockMode::PER_BLOCK);
        const auto blocks = reinterpret_cast<const std::int32_t*>(js2int<std::uintptr_t>(blocks_raw));
        scran_norm::center_size_factors_blocked(n, ptr, blocks, NULL, opt);
    } else {
        scran_norm::center_size_factors(n, ptr, NULL, opt);
    }
}

NumericMatrix js_normalize_counts(const NumericMatrix& mat, JsFakeInt size_factors_raw, bool log, bool allow_zero, bool allow_non_finite) {
    const auto size_factors = js2int<std::uintptr_t>(size_factors_raw);
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
    return NumericMatrix(scran_norm::normalize_counts(mat.ptr(), std::move(sf), norm_opt));
}

EMSCRIPTEN_BINDINGS(normalize_counts) {
    emscripten::function("center_size_factors", &js_center_size_factors, emscripten::return_value_policy::take_ownership());
    emscripten::function("normalize_counts", &js_normalize_counts, emscripten::return_value_policy::take_ownership());
}
