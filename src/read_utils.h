#ifndef INIT_UTILS_HPP
#define INIT_UTILS_HPP

#include <cstdint>
#include <cstddef>

#include "NumericMatrix.h"
#include "tatami/tatami.hpp"
#include "tatami_layered/tatami_layered.hpp"

template<typename StorageValue_, class ValueVector_, class IndexVector_, class PointerVector_>
NumericMatrix copy_into_sparse(MatrixIndex nrows, MatrixIndex ncols, const ValueVector_& x, const IndexVector_& i, const PointerVector_& p) {
    return NumericMatrix(
        std::make_shared<tatami::CompressedSparseRowMatrix<
            MatrixValue,
            MatrixIndex,
            std::vector<StorageValue_>,
            std::vector<MatrixIndex>,
            std::vector<std::size_t>
        > >(
            nrows,
            ncols, 
            std::vector<StorageValue_>(x.begin(), x.end()),
            std::vector<MatrixIndex>(i.begin(), i.end()),
            std::vector<std::size_t>(p.begin(), p.end())
        )
    );
}

template<typename Value_, typename Index_>
NumericMatrix sparse_from_tatami(const tatami::Matrix<Value_, Index_>& mat, bool layered) {
    if (layered) {
        return NumericMatrix(tatami_layered::convert_to_layered_sparse<MatrixValue, MatrixIndex>(mat));
    } else {
        return NumericMatrix(tatami::convert_to_compressed_sparse<MatrixValue, MatrixIndex, Value_, Index_>(&mat, true));
    }
}

#endif
