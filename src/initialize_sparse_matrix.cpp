#include <emscripten/bind.h>
#include "NumericMatrix.h"
#include "tatami/ext/convert_to_layered_sparse.hpp"
#include "tatami/ext/SomeNumericArray.hpp"

/**
 * @cond
 */
template<typename T>
tatami::SomeNumericArray<T> create_SomeNumericArray(uintptr_t ptr, size_t len, std::string type) {
    typename tatami::SomeNumericArray<T>::Type t;

    if (type == "Int8Array") {
        t = tatami::SomeNumericArray<T>::I8;
    } else if (type == "Uint8Array") {
        t = tatami::SomeNumericArray<T>::U8;
    } else if (type == "Int16Array") {
        t = tatami::SomeNumericArray<T>::I16;
    } else if (type == "Uint16Array") {
        t = tatami::SomeNumericArray<T>::U16;
    } else if (type == "Int32Array") {
        t = tatami::SomeNumericArray<T>::I32;
    } else if (type == "Uint32Array") {
        t = tatami::SomeNumericArray<T>::U32;
    } else if (type == "BigInt64Array") {
        t = tatami::SomeNumericArray<T>::F64; // Aliasing these for the time being, as there is no BigInt support in the Wasm heap.
    } else if (type == "BigUint64Array") {
        t = tatami::SomeNumericArray<T>::F64; // See above.
    } else if (type == "Float32Array") {
        t = tatami::SomeNumericArray<T>::F32;
    } else if (type == "Float64Array") {
        t = tatami::SomeNumericArray<T>::F64;
    } else {
        throw std::runtime_error("unknown array type '" + type + "'");
    }

    return tatami::SomeNumericArray<T>(reinterpret_cast<void*>(ptr), len, t);
}
/**
 * @endcond
 */

/**
 * @param nrows Number of rows.
 * @param ncols Number of columns.
 * @param[in] values Offset to an integer array of length `nrows*ncols` containing the contents of the matrix.
 * This is assumed to be in column-major format.
 * @param type Type of the `values` array, as the name of a TypedArray subclass.
 *
 * @return A `NumericMatrix` containing a layered sparse matrix.
 */
NumericMatrix initialize_sparse_matrix_from_dense_vector(size_t nrows, size_t ncols, uintptr_t values, std::string type) {
    auto vals = create_SomeNumericArray<int>(values, nrows*ncols, type);
    tatami::DenseColumnMatrix<double, int, decltype(vals)> mat(nrows, ncols, vals);
    auto output = tatami::convert_to_layered_sparse(&mat); 
    return NumericMatrix(std::move(output.matrix), std::move(output.permutation));
}

/**
 * @param nrows Number of rows.
 * @param ncols Number of columns.
 * @param nelements Number of non-zero elements.
 * @param[in] values Offset to an integer array of length `nelements` containing the values of the non-zero elements.
 * @param value_type Type of the `values` array, as the name of a TypedArray subclass.
 * @param[in] indices Offset to an integer array of length `nelements` containing the indices of the non-zero elements.
 * @param index_type Type of the `indices` array, as the name of a TypedArray subclass.
 * @param[in] indptrs Offset to an integer array of length `nelements` containing the index pointers for each row/column in the compressed sparse format.
 * @param indptr_type Type of the `indptrs` array, as the name of a TypedArray subclass.
 * @param csc Are the inputs in compressed sparse column format?
 * Set to `false` for data in the compressed sparse row format.
 *
 * @return A `NumericMatrix` containing a layered sparse matrix.
 */
NumericMatrix initialize_sparse_matrix(size_t nrows, size_t ncols, size_t nelements, 
    uintptr_t values, std::string value_type,
    uintptr_t indices, std::string index_type,
    uintptr_t indptrs, std::string indptr_type,
    bool csc)
{
    auto val = create_SomeNumericArray<int>(values, nelements, value_type);
    auto idx = create_SomeNumericArray<int>(indices, nelements, index_type);

    std::shared_ptr<tatami::Matrix<double, int> > mat;
    if (csc) {
        auto ind = create_SomeNumericArray<size_t>(indptrs, ncols + 1, indptr_type);
        mat.reset(new tatami::CompressedSparseColumnMatrix<double, int, decltype(val), decltype(idx), decltype(ind)>(nrows, ncols, val, idx, ind));
    } else {
        auto ind = create_SomeNumericArray<size_t>(indptrs, nrows + 1, indptr_type);
        mat.reset(new tatami::CompressedSparseRowMatrix<double, int, decltype(val), decltype(idx), decltype(ind)>(nrows, ncols, val, idx, ind));
    }

    auto output = tatami::convert_to_layered_sparse(mat.get()); 
    return NumericMatrix(std::move(output.matrix), std::move(output.permutation));
}

/**
 * @param nrows Number of rows.
 * @param ncols Number of columns.
 * @param[in] values Offset to an integer array of length `nrows*ncols` containing the contents of the matrix.
 * This is assumed to be in column-major format.
 * @param type Type of the `values` array, as the name of a TypedArray subclass.
 *
 * @return A `NumericMatrix` containing a dense matrix.
 */
NumericMatrix initialize_dense_matrix(size_t nrows, size_t ncols, uintptr_t values, std::string type) {
    std::vector<double> tmp(nrows* ncols);
    auto vals = create_SomeNumericArray<double>(values, nrows*ncols, type);
    std::copy(vals.begin(), vals.end(), tmp.begin());
    auto ptr = std::shared_ptr<const tatami::NumericMatrix>(new tatami::DenseColumnMatrix<double, int>(nrows, ncols, std::move(tmp)));
    return NumericMatrix(std::move(ptr));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(initialize_sparse_matrix) {
    emscripten::function("initialize_sparse_matrix", &initialize_sparse_matrix);

    emscripten::function("initialize_sparse_matrix_from_dense_vector", &initialize_sparse_matrix_from_dense_vector);

    emscripten::function("initialize_dense_matrix", &initialize_dense_matrix);
}
/**
 * @endcond
 */
