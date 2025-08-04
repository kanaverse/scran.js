#include <emscripten/bind.h>

#include "tatami/tatami.hpp"

#include <vector>
#include <cstdint>
#include <cstddef>

void transpose_matrix(std::size_t nr, std::size_t nc, std::uintptr_t input, bool column_major, std::uintptr_t output) {
    tatami::transpose(
        reinterpret_cast<const double*>(input),
        (column_major ? nc : nr),
        (column_major ? nr : nc),
        reinterpret_cast<double*>(output)
    );
}

EMSCRIPTEN_BINDINGS(transpose_matrix) {
    emscripten::function("transpose_matrix", &transpose_matrix, emscripten::return_value_policy::take_ownership());
}

