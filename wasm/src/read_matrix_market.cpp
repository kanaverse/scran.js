#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "tatami/ext/MatrixMarket.hpp"
#include <string>

NumericMatrix read_matrix_market(std::string input) {
    auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix(input.c_str());
    NumericMatrix output(std::move(stuff.matrix));
    output.permutation = stuff.permutation;
    return output;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(read_matrix_market) {
    emscripten::function("read_matrix_market", &read_matrix_market);
}
/**
 * @endcond
 */
