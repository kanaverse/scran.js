#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/scran.hpp"

#include <vector>

void grouped_size_factors(const NumericMatrix& mat, uintptr_t groups, bool center, double prior_count, int reference, uintptr_t output, int nthreads) {
    scran::GroupedSizeFactors runner;
    runner.set_center(center).set_prior_count(prior_count).set_num_threads(nthreads);

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
