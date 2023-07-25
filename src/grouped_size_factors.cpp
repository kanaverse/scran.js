#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/scran.hpp"

#include <vector>

void grouped_size_factors(const NumericMatrix& mat, 
    uintptr_t groups, 
    bool center, 
    bool allow_zero,
    bool allow_non_finite,
    double prior_count, 
    int reference, 
    uintptr_t output, 
    int nthreads) 
{
    scran::GroupedSizeFactors runner;
    runner.set_center(center);
    runner.set_prior_count(prior_count);
    runner.set_num_threads(nthreads);
    runner.set_handle_zeros(allow_zero);
    runner.set_handle_non_finite(allow_non_finite);

    auto gptr = reinterpret_cast<const int*>(groups);
    auto optr = reinterpret_cast<double*>(output);

    if (reference >= 0) {
        runner.run(mat.ptr.get(), gptr, reference, optr);
    } else {
        runner.run(mat.ptr.get(), gptr, optr);
    }
    return;
}

EMSCRIPTEN_BINDINGS(grouped_size_factors) {
    emscripten::function("grouped_size_factors", &grouped_size_factors);
}
