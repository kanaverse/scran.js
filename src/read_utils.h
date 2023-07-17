#ifndef INIT_UTILS_HPP
#define INIT_UTILS_HPP

#include "NumericMatrix.h"
#include "parallel.h"

#include "tatami/tatami.hpp"
#include "tatami/ext/layered/convert_to_layered_sparse.hpp"

inline std::vector<size_t> permutation_to_indices(const std::vector<size_t>& permutation) { 
    std::vector<size_t> ids(permutation.size());
    for (size_t i = 0; i < ids.size(); ++i) {
        ids[permutation[i]] = i;
    }
    return ids;
}

template<typename T, class X, class I, class P>
NumericMatrix copy_into_sparse(size_t nrows, size_t ncols, const X& x, const I& i, const P& p) {
    return NumericMatrix(new tatami::CompressedSparseColumnMatrix<double, int, std::vector<T> >(
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
        auto output = tatami::convert_to_layered_sparse(mat); 
        return NumericMatrix(std::move(output.matrix), permutation_to_indices(output.permutation));
    } else {
        auto output = tatami::convert_to_sparse<false, double, int, typename Matrix::data_type, typename Matrix::index_type>(mat);
        return NumericMatrix(std::move(output));
    }
}

#endif
