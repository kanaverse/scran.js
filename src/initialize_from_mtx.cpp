#include <emscripten.h>
#include <emscripten/bind.h>

#include <cstdint>
#include <cstddef>
#include <string>
#include <stdexcept>

#include "utils.h"
#include "read_utils.h"
#include "NumericMatrix.h"

#include "tatami_mtx/tatami_mtx.hpp"
#include "tatami_layered/tatami_layered.hpp"
#include "eminem/eminem.hpp"

NumericMatrix initialize_from_mtx_buffer(std::uintptr_t buffer, JsFakeInt size_raw, std::string compression, bool layered) {
    const auto size = js2int<std::size_t>(size_raw);
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    if (layered) {
        if (compression == "none") {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_text_buffer<MatrixValue, MatrixIndex>(bufptr, size));
        } else if (compression == "gzip") {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_zlib_buffer<MatrixValue, MatrixIndex>(bufptr, size));
        } else if (compression != "unknown") {
            throw std::runtime_error("unknown compression '" + compression + "'");
        }
        return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_some_buffer<MatrixValue, MatrixIndex>(bufptr, size));

    } else {
        tatami_mtx::Options opt;
        opt.row = true;
        if (compression == "none") {
            return NumericMatrix(tatami_mtx::load_matrix_from_text_buffer<MatrixValue, MatrixIndex>(bufptr, size, opt));
        } else if (compression == "gzip") {
            return NumericMatrix(tatami_mtx::load_matrix_from_zlib_buffer<MatrixValue, MatrixIndex>(bufptr, size, opt));
        } else if (compression != "unknown") {
            throw std::runtime_error("unknown compression '" + compression + "'");
        } 
        return NumericMatrix(tatami_mtx::load_matrix_from_some_buffer<MatrixValue, MatrixIndex>(bufptr, size, opt));
    }
}

NumericMatrix initialize_from_mtx_file(std::string path, std::string compression, bool layered) {
    if (layered) {
        if (compression == "none") {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_text_file<MatrixValue, MatrixIndex>(path.c_str()));
        } else if (compression == "gzip") {
            return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_gzip_file<MatrixValue, MatrixIndex>(path.c_str()));
        } else if (compression != "unknown") {
            throw std::runtime_error("unknown compression '" + compression + "'");
        }
        return NumericMatrix(tatami_layered::read_layered_sparse_from_matrix_market_some_file<MatrixValue, MatrixIndex>(path.c_str()));

    } else {
        tatami_mtx::Options opt;
        opt.row = true;
        if (compression == "none") {
            return NumericMatrix(tatami_mtx::load_matrix_from_text_file<MatrixValue, MatrixIndex>(path.c_str(), opt));
        } else if (compression == "gzip") {
            return NumericMatrix(tatami_mtx::load_matrix_from_gzip_file<MatrixValue, MatrixIndex>(path.c_str(), opt));
        } else if (compression != "unknown") {
            throw std::runtime_error("unknown compression '" + compression + "'");
        }
        return NumericMatrix(tatami_mtx::load_matrix_from_some_file<MatrixValue, MatrixIndex>(path.c_str(), opt));
    }
}

emscripten::val get_preamble(std::unique_ptr<byteme::PerByteSerial<char> > input) {
    eminem::Parser<I<decltype(input)> > parser(std::move(input), {});
    parser.scan_preamble();
    auto output = emscripten::val::object();
    output.set("rows", int2js(parser.get_nrows()));
    output.set("columns", int2js(parser.get_ncols()));
    output.set("lines", int2js(parser.get_nlines()));
    return output;
}

emscripten::val read_header_from_mtx_buffer(std::uintptr_t buffer, JsFakeInt size_raw, std::string compression) {
    const auto size = js2int<std::size_t>(size_raw);
    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    std::unique_ptr<byteme::Reader> input;
    if (compression == "none") {
        input.reset(new byteme::RawBufferReader(bufptr, size));
    } else if (compression == "gzip") {
        input.reset(new byteme::ZlibBufferReader(bufptr, size, {}));
    } else if (compression == "unknown") {
        input.reset(new byteme::SomeBufferReader(bufptr, size, {}));
    } else {
        throw std::runtime_error("unknown compression '" + compression + "'");
    }
    return get_preamble(std::make_unique<byteme::PerByteSerial<char> >(std::move(input)));
}

emscripten::val read_header_from_mtx_file(std::string path, std::string compression) {
    std::unique_ptr<byteme::Reader> input;
    if (compression == "none") {
        input.reset(new byteme::RawFileReader(path.c_str(), {}));
    } else if (compression == "gzip") {
        input.reset(new byteme::GzipFileReader(path.c_str(), {}));
    } else if (compression == "unknown") {
        input.reset(new byteme::SomeFileReader(path.c_str(), {}));
    } else {
        throw std::runtime_error("unknown compression '" + compression + "'");
    }
    return get_preamble(std::make_unique<byteme::PerByteSerial<char> >(std::move(input)));
}

EMSCRIPTEN_BINDINGS(read_matrix_market) {
    emscripten::function("initialize_from_mtx_buffer", &initialize_from_mtx_buffer, emscripten::return_value_policy::take_ownership());
    emscripten::function("initialize_from_mtx_file", &initialize_from_mtx_file, emscripten::return_value_policy::take_ownership());
    emscripten::function("read_header_from_mtx_buffer", &read_header_from_mtx_buffer, emscripten::return_value_policy::take_ownership());
    emscripten::function("read_header_from_mtx_file", &read_header_from_mtx_file, emscripten::return_value_policy::take_ownership());
}
