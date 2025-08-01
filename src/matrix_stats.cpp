#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "tatami_stats/tatami_stats.hpp"

#include <vector>
#include <cstdint>

void matrix_sums(const NumericMatrix& mat, bool row, uintptr_t buffer, int32_t nthreads) {
    tatami_stats::sums::Options opt;
    opt.num_threads = nthreads;
    tatami_stats::sums::apply(row, mat.ptr.get(), reinterpret_cast<double*>(buffer), opt);
}

EMSCRIPTEN_BINDINGS(matrix_stats) {
    emscripten::function("matrix_sums", &matrix_sums, emscripten::return_value_policy::take_ownership());
}
