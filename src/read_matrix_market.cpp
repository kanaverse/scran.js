#include <emscripten.h>
#include <emscripten/bind.h>

#include <cstdint>

#include "read_utils.h"
#include "NumericMatrix.h"
#include "parallel.h"

#include "tatami_mtx/tatami_mtx.hpp"
#include "tatami_layered/tatami_layered.hpp"

NumericMatrix read_matrix_market_from_buffer(uintptr_t buffer, int size, int compressed, bool layered) {
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    if (layered) {
        if (compressed == 0) {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_text_buffer(bufptr, size));
        } else if (compressed == 1) {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_zlib_buffer(bufptr, size));
        } else {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_some_buffer(bufptr, size));
        }
    } else {
        if (compressed == 0) {
            return NumericMatrix(tatami_mtx::load_matrix_from_text_buffer<true, double, int>(bufptr, size));
        } else if (compressed == 1) {
            return NumericMatrix(tatami_mtx::load_matrix_from_zlib_buffer<true, double, int>(bufptr, size));
        } else {
            return NumericMatrix(tatami_mtx::load_matrix_from_some_buffer<true, double, int>(bufptr, size));
        } 
    }
}

NumericMatrix read_matrix_market_from_file(std::string path, int compressed, bool layered) {
    if (layered) {
        if (compressed == 0) {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_text_file(path.c_str()));
        } else if (compressed == 1) {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_gzip_file(path.c_str()));
        } else {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_some_file(path.c_str()));
        }
    } else {
        if (compressed == 0) {
            return NumericMatrix(tatami_mtx::load_matrix_from_text_file<true, double, int>(path.c_str()));
        } else if (compressed == 1) {
            return NumericMatrix(tatami_mtx::load_matrix_from_gzip_file<true, double, int>(path.c_str()));
        } else {
            return NumericMatrix(tatami_mtx::load_matrix_from_some_file<true, double, int>(path.c_str()));
        }
    }
}

template<class Parser_>
void check_preamble(Parser_ parser, uintptr_t output) {
    double* outptr = reinterpret_cast<double*>(output);
    parser.scan_preamble();
    outptr[0] = parser.get_nrows();
    outptr[1] = parser.get_ncols();
    outptr[2] = parser.get_nlines();
}


void read_matrix_market_header_from_buffer(uintptr_t buffer, int size, int compressed, uintptr_t output) {
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    if (compressed == 0) {
        check_preamble(eminem::TextBufferParser(bufptr, size), output);
    } else if (compressed == 1) {
        check_preamble(eminem::ZlibBufferParser(bufptr, size), output);
    } else {
        check_preamble(eminem::SomeBufferParser(bufptr, size), output);
    }
}

void read_matrix_market_header_from_file(std::string path, int compressed, uintptr_t output) {
    if (compressed == 0) {
        check_preamble(eminem::TextFileParser(path.c_str()), output);
    } else if (compressed == 1) {
        check_preamble(eminem::GzipFileParser(path.c_str()), output);
    } else {
        check_preamble(eminem::SomeFileParser(path.c_str()), output);
    }
}

EMSCRIPTEN_BINDINGS(read_matrix_market) {
    emscripten::function("read_matrix_market_from_buffer", &read_matrix_market_from_buffer, emscripten::return_value_policy::take_ownership());
    emscripten::function("read_matrix_market_from_file", &read_matrix_market_from_file, emscripten::return_value_policy::take_ownership());
    emscripten::function("read_matrix_market_header_from_buffer", &read_matrix_market_header_from_buffer, emscripten::return_value_policy::take_ownership());
    emscripten::function("read_matrix_market_header_from_file", &read_matrix_market_header_from_file, emscripten::return_value_policy::take_ownership());
}
