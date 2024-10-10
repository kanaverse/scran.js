#include <emscripten.h>
#include <emscripten/bind.h>

#include <cstdint>

#include "read_utils.h"
#include "NumericMatrix.h"

#include "tatami_mtx/tatami_mtx.hpp"
#include "tatami_layered/tatami_layered.hpp"

NumericMatrix initialize_from_mtx_buffer(uintptr_t buffer, size_t size, std::string compression, bool layered) {
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    if (layered) {
        if (compression == "none") {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_text_buffer<double, int32_t>(bufptr, size));
        } else if (compression == "gzip") {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_zlib_buffer<double, int32_t>(bufptr, size));
        } else if (compression != "unknown") {
            throw std::runtime_error("unknown compression '" + compression + "'");
        }
        return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_some_buffer<double, int32_t>(bufptr, size));

    } else {
        tatami_mtx::Options opt;
        opt.row = true;
        if (compression == "none") {
            return NumericMatrix(tatami_mtx::load_matrix_from_text_buffer<double, int32_t>(bufptr, size, opt));
        } else if (compression == "gzip") {
            return NumericMatrix(tatami_mtx::load_matrix_from_zlib_buffer<double, int32_t>(bufptr, size, opt));
        } else if (compression != "unknown") {
            throw std::runtime_error("unknown compression '" + compression + "'");
        } 
        return NumericMatrix(tatami_mtx::load_matrix_from_some_buffer<double, int32_t>(bufptr, size, opt));
    }
}

NumericMatrix initialize_from_mtx_file(std::string path, std::string compression, bool layered) {
    if (layered) {
        if (compression == "none") {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_text_file<double, int32_t>(path.c_str()));
        } else if (compression == "gzip") {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_gzip_file<double, int32_t>(path.c_str()));
        } else if (compression != "unknown") {
            throw std::runtime_error("unknown compression '" + compression + "'");
        }
        return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_some_file<double, int32_t>(path.c_str()));

    } else {
        tatami_mtx::Options opt;
        opt.row = true;
        if (compression == "none") {
            return NumericMatrix(tatami_mtx::load_matrix_from_text_file<double, int32_t>(path.c_str(), opt));
        } else if (compression == "gzip") {
            return NumericMatrix(tatami_mtx::load_matrix_from_gzip_file<double, int32_t>(path.c_str(), opt));
        } else if (compression != "unknown") {
            throw std::runtime_error("unknown compression '" + compression + "'");
        }
        return NumericMatrix(tatami_mtx::load_matrix_from_some_file<double, int32_t>(path.c_str(), opt));
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

void read_header_from_mtx_buffer(uintptr_t buffer, int32_t size, std::string compression, uintptr_t output) {
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    if (compression == "none") {
        check_preamble(eminem::TextBufferParser(bufptr, size), output);
    } else if (compression == "gzip") {
        check_preamble(eminem::ZlibBufferParser(bufptr, size), output);
    } else if (compression == "unknown") {
        check_preamble(eminem::SomeBufferParser(bufptr, size), output);
    } else {
        throw std::runtime_error("unknown compression '" + compression + "'");
    }
}

void read_header_from_mtx_file(std::string path, std::string compression, uintptr_t output) {
    if (compression == "none") {
        check_preamble(eminem::TextFileParser(path.c_str()), output);
    } else if (compression == "gzip") {
        check_preamble(eminem::GzipFileParser(path.c_str()), output);
    } else if (compression == "unknown") {
        check_preamble(eminem::SomeFileParser(path.c_str()), output);
    } else {
        throw std::runtime_error("unknown compression '" + compression + "'");
    }
}

EMSCRIPTEN_BINDINGS(read_matrix_market) {
    emscripten::function("initialize_from_mtx_buffer", &initialize_from_mtx_buffer, emscripten::return_value_policy::take_ownership());
    emscripten::function("initialize_from_mtx_file", &initialize_from_mtx_file, emscripten::return_value_policy::take_ownership());
    emscripten::function("read_header_from_mtx_buffer", &read_header_from_mtx_buffer, emscripten::return_value_policy::take_ownership());
    emscripten::function("read_header_from_mtx_file", &read_header_from_mtx_file, emscripten::return_value_policy::take_ownership());
}
