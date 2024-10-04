#ifndef INIT_UTILS_HPP
#define INIT_UTILS_HPP

#include "NumericMatrix.h"
#include "tatami/tatami.hpp"
#include "tatami_layered/tatami_layered.hpp"

template<typename StorageValue_, class ValueVector_, class IndexVector_, class PointerVector_>
NumericMatrix copy_into_sparse(size_t nrows, size_t ncols, const ValueVector_& x, const IndexVector_& i, const PointerVector_& p) {
    return NumericMatrix(new tatami::CompressedSparseRowMatrix<double, int, std::vector<StorageValue_> >(
        nrows,
        ncols, 
        std::vector<StorageValue_>(x.begin(), x.end()),
        std::vector<int>(i.begin(), i.end()),
        std::vector<size_t>(p.begin(), p.end())
    ));
}

template<typename Value_, typename Index_>
NumericMatrix sparse_from_tatami(const tatami::Matrix<Value_, Index_>& mat, bool layered) {
    if (layered) {
        return NumericMatrix(tatami_layered::convert_to_layered_sparse(mat));
    } else {
        return NumericMatrix(tatami::convert_to_compressed_sparse<double, int, Value_, Index_>(&mat, true));
    }
}

#endif
