#include <emscripten.h>
#include <emscripten/bind.h>

#include "read_utils.h"
#include "NumericMatrix.h"
#include <cstdint>

#include "tatami/ext/MatrixMarket_layered.hpp"

NumericMatrix read_matrix_market_from_buffer(uintptr_t buffer, int size, int compressed, bool layered) {
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);

    if (layered) {
        auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix_from_buffer(bufptr, size, compressed);
        return NumericMatrix(std::move(stuff.matrix), permutation_to_indices(stuff.permutation));
    } else {
        auto stuff = tatami::MatrixMarket::load_sparse_matrix_from_buffer(bufptr, size, compressed);
        return NumericMatrix(std::move(stuff));
    }
}

NumericMatrix read_matrix_market_from_file(std::string path, int compressed, bool layered) {
    if (layered) {
        auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix_from_file(path.c_str(), compressed);
        return NumericMatrix(std::move(stuff.matrix), permutation_to_indices(stuff.permutation));
    } else {
        auto stuff = tatami::MatrixMarket::load_sparse_matrix_from_file(path.c_str(), compressed);
        return NumericMatrix(std::move(stuff));
    }
}

void read_matrix_market_header_from_buffer(uintptr_t buffer, int size, int compressed, uintptr_t output) {
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    auto stuff = tatami::MatrixMarket::extract_header_from_buffer(bufptr, size, compressed);

    double* outptr = reinterpret_cast<double*>(output);
    outptr[0] = stuff.nrow;
    outptr[1] = stuff.ncol;
    outptr[2] = stuff.nlines;
    return;
}

void read_matrix_market_header_from_file(std::string path, int compressed, uintptr_t output) {
    auto stuff = tatami::MatrixMarket::extract_header_from_file(path.c_str(), compressed);
    double* outptr = reinterpret_cast<double*>(output);
    outptr[0] = stuff.nrow;
    outptr[1] = stuff.ncol;
    outptr[2] = stuff.nlines;
    return;
}

EMSCRIPTEN_BINDINGS(read_matrix_market) {
    emscripten::function("read_matrix_market_from_buffer", &read_matrix_market_from_buffer);
    emscripten::function("read_matrix_market_from_file", &read_matrix_market_from_file);
    emscripten::function("read_matrix_market_header_from_buffer", &read_matrix_market_header_from_buffer);
    emscripten::function("read_matrix_market_header_from_file", &read_matrix_market_header_from_file);
}
