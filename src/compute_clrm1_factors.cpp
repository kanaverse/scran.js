#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "clrm1.hpp"

void compute_clrm1_factors(const NumericMatrix& mat, uintptr_t output, int32_t nthreads) {
    clrm1::Options opt;
    opt.num_threads = nthreads;
    clrm1::compute(*(mat.ptr), opt, reinterpret_cast<double*>(output));
}

EMSCRIPTEN_BINDINGS(compute_clrm1_factors) {
    emscripten::function("compute_clrm1_factors", &compute_clrm1_factors, emscripten::return_value_policy::take_ownership());
}
