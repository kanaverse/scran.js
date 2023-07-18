#ifndef INIT_UTILS_HPP
#define INIT_UTILS_HPP

#include "NumericMatrix.h"
#include "parallel.h"

#include "tatami/tatami.hpp"
#include "tatami_layered/tatami_layered.hpp"

template<typename T, class X, class I, class P>
NumericMatrix copy_into_sparse(size_t nrows, size_t ncols, const X& x, const I& i, const P& p) {
    return NumericMatrix(new tatami::CompressedSparseRowMatrix<double, int, std::vector<T> >(
        nrows,
        ncols, 
        std::vector<T>(x.begin(), x.end()),
        std::vector<int>(i.begin(), i.end()),
        std::vector<size_t>(p.begin(), p.end())
    ));
}

template<class Matrix>
NumericMatrix sparse_from_tatami(const Matrix* mat, bool layered) {
    if (layered) {
        return NumericMatrix(tatami_layered::convert_to_layered_sparse(mat));
    } else {
        return NumericMatrix(tatami::convert_to_sparse<false, double, int, typename Matrix::value_type, typename Matrix::index_type>(mat));
    }
}

#endif
