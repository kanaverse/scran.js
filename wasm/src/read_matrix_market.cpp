#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "tatami/ext/MatrixMarket.hpp"
#include <string>
#include <iostream>

template<typename T = double, typename IDX = int>
tatami::MatrixMarket::LayeredMatrixData<T, IDX> load_layered_sparse_matrix_from_buffer(const char* buffer, size_t len) {
    auto process = [&](auto& obj) -> void {
        size_t counter = 0;
        auto copy = buffer;
        while (counter < len) {
            auto processed = obj.add(copy, len);
            counter += processed;
            copy += processed;
        }
    };

    tatami::MatrixMarket::LineAssignments ass;
    process(ass);
    ass.finish();

    std::cout << ass.nrows << "\t" << ass.ncols << std::endl;

    tatami::MatrixMarket::LayeredMatrixData<T, IDX> output;
    output.permutation = ass.permutation;

    constexpr size_t max16 = std::numeric_limits<uint16_t>::max();
    if (ass.nrows > max16) {
        tatami::MatrixMarket::LayeredBuilder<uint16_t> builder(std::move(ass));
        process(builder);
        output.matrix = builder.template finish<T, IDX>();
    } else {
        tatami::MatrixMarket::LayeredBuilder<IDX> builder(std::move(ass));
        process(builder);
        output.matrix = builder.template finish<T, IDX>();
    }

    return output;
}

NumericMatrix read_matrix_market(uintptr_t buffer, int size) {
    auto process = [&](auto& stuff) {
        NumericMatrix output(std::move(stuff.matrix));
        output.permutation = stuff.permutation;
        return output;
    };

    const char* bufptr = reinterpret_cast<const char*>(buffer);

//    if (input.length() >= 3 && (0 == input.compare(input.length() - input.length(), input.length(), ".gz"))) {
//        auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix_gzip(input.c_str());
//        return process(stuff);
//    } else {
        auto stuff = load_layered_sparse_matrix_from_buffer(bufptr, size);
        return process(stuff);
//    }
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
