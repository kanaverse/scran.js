#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "clrm1.hpp"

void compute_clrm1_factors(const NumericMatrix& mat, JsFakeInt output_raw, JsFakeInt nthreads_raw) {
    clrm1::Options opt;
    opt.num_threads = js2int<int>(nthreads_raw);
    const auto output = js2int<std::uintptr_t>(output_raw);
    clrm1::compute(*mat, opt, reinterpret_cast<double*>(output));
}

EMSCRIPTEN_BINDINGS(compute_clrm1_factors) {
    emscripten::function("compute_clrm1_factors", &compute_clrm1_factors, emscripten::return_value_policy::take_ownership());
}
