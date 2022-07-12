#include <emscripten.h>
#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#include "tatami/ext/MatrixMarket_layered.hpp"

NumericMatrix read_matrix_market_from_buffer(uintptr_t buffer, int size, int compressed) {
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix_from_buffer(bufptr, size, compressed);
    return NumericMatrix(std::move(stuff.matrix), permutation_to_indices(stuff.permutation));
}

NumericMatrix read_matrix_market_from_file(std::string path, int compressed) {
    auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix_from_file(path.c_str(), compressed);
    return NumericMatrix(std::move(stuff.matrix), permutation_to_indices(stuff.permutation));
}

EMSCRIPTEN_BINDINGS(read_matrix_market) {
    emscripten::function("read_matrix_market_from_buffer", &read_matrix_market_from_buffer);
    emscripten::function("read_matrix_market_from_file", &read_matrix_market_from_file);
}
