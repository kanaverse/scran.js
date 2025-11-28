#include <emscripten/bind.h>

#include "tatami/tatami.hpp"

#include "utils.h"

#include <vector>
#include <cstdint>
#include <cstddef>

void js_transpose_matrix(JsFakeInt nr_raw, JsFakeInt nc_raw, JsFakeInt input_raw, bool column_major, JsFakeInt output_raw) {
    const auto nr = js2int<std::size_t>(nr_raw);
    const auto nc = js2int<std::size_t>(nc_raw);
    const auto input = js2int<std::uintptr_t>(input_raw);
    const auto output = js2int<std::uintptr_t>(output_raw);
    tatami::transpose(
        reinterpret_cast<const double*>(input),
        (column_major ? nc : nr),
        (column_major ? nr : nc),
        reinterpret_cast<double*>(output)
    );
}

EMSCRIPTEN_BINDINGS(transpose_matrix) {
    emscripten::function("transpose_matrix", &js_transpose_matrix, emscripten::return_value_policy::take_ownership());
}

