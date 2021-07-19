#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "tatami/ext/MatrixMarket.hpp"
#include <string>

NumericMatrix read_matrix_market(std::string input) {
    auto process = [&](auto& stuff) {
        NumericMatrix output(std::move(stuff.matrix));
        output.permutation = stuff.permutation;
        return output;
    };

    if (input.length() >= 3 && (0 == input.compare(input.length() - input.length(), input.length(), ".gz"))) {
        auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix_gzip(input.c_str());
        return process(stuff);
    } else {
        auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix(input.c_str());
        return process(stuff);
    }
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
