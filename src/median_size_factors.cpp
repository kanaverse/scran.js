#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/scran.hpp"

#include <vector>
#include <cstdint>

void median_size_factors(const NumericMatrix& mat, bool use_ref, uintptr_t ref, bool center, double prior_count, uintptr_t output, int nthreads) {
    scran::MedianSizeFactors med;
    med.set_center(center).set_prior_count(prior_count).set_num_threads(nthreads);
    auto optr = reinterpret_cast<double*>(output);

    if (!use_ref) {
        med.run_with_mean(mat.ptr.get(), optr);
    } else {
        auto rptr = reinterpret_cast<const double*>(ref);
        med.run(mat.ptr.get(), rptr, optr);
    }

    return;
}

EMSCRIPTEN_BINDINGS(median_size_factors) {
    emscripten::function("median_size_factors", &median_size_factors);
}
