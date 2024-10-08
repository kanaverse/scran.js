#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "read_utils.h"
#include "parallel.h"

#include "tatami/utils/SomeNumericArray.hpp"

template<typename T>
tatami::SomeNumericArray<T> create_SomeNumericArray(uintptr_t ptr, size_t len, const std::string& type) {
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

bool is_type_integer(const std::string& type) {
    if (type.size() >= 3 && type.rfind("Int", 0) == 0) {
        return true;
    } else if (type.size() >= 4 && type.rfind("Uint", 0) == 0) {
        return true;
    }
    return false;
}

/**********************************/

template<typename T>
NumericMatrix initialize_sparse_matrix_from_dense_vector_internal(size_t nrows, size_t ncols, uintptr_t values, const std::string& type, bool layered) {
    auto vals = create_SomeNumericArray<T>(values, nrows*ncols, type);
    tatami::DenseColumnMatrix<T, int, decltype(vals)> mat(nrows, ncols, vals);
    return sparse_from_tatami(&mat, layered);
}

NumericMatrix initialize_sparse_matrix_from_dense_vector(size_t nrows, size_t ncols, uintptr_t values, std::string type, bool force_integer, bool layered) {
    if (force_integer || is_type_integer(type)) {
        return initialize_sparse_matrix_from_dense_vector_internal<int>(nrows, ncols, values, type, layered);
    } else {
        return initialize_sparse_matrix_from_dense_vector_internal<double>(nrows, ncols, values, type, false);
    }
}

/**********************************/

template<typename T>
NumericMatrix initialize_sparse_matrix_internal(size_t nrows, size_t ncols, size_t nelements, 
    uintptr_t values, const std::string& value_type,
    uintptr_t indices, const std::string& index_type,
    uintptr_t indptrs, const std::string& indptr_type,
    bool by_row, bool layered)
{
    auto val = create_SomeNumericArray<T>(values, nelements, value_type);
    auto idx = create_SomeNumericArray<int>(indices, nelements, index_type);

    if (by_row && !layered) {
        // Directly creating a CSR matrix.
        auto ind = create_SomeNumericArray<size_t>(indptrs, nrows + 1, indptr_type);
        return copy_into_sparse<T>(nrows, ncols, val, idx, ind);
    } else {
        std::shared_ptr<tatami::Matrix<T, int> > mat;
        if (by_row) {
            auto ind = create_SomeNumericArray<size_t>(indptrs, nrows + 1, indptr_type);
            mat.reset(new tatami::CompressedSparseRowMatrix<T, int, decltype(val), decltype(idx), decltype(ind)>(nrows, ncols, val, idx, ind));
        } else {
            auto ind = create_SomeNumericArray<size_t>(indptrs, ncols + 1, indptr_type);
            mat.reset(new tatami::CompressedSparseColumnMatrix<T, int, decltype(val), decltype(idx), decltype(ind)>(nrows, ncols, val, idx, ind));
        }
        return sparse_from_tatami(mat.get(), layered);
    }
}

NumericMatrix initialize_sparse_matrix(size_t nrows, size_t ncols, size_t nelements, 
    uintptr_t values, std::string value_type,
    uintptr_t indices, std::string index_type,
    uintptr_t indptrs, std::string indptr_type,
    bool by_row, bool force_integer, bool layered)
{
    if (force_integer || is_type_integer(value_type)) {
        return initialize_sparse_matrix_internal<int>(nrows, ncols, nelements, values, value_type, indices, index_type, indptrs, indptr_type, by_row, layered);
    } else {
        return initialize_sparse_matrix_internal<double>(nrows, ncols, nelements, values, value_type, indices, index_type, indptrs, indptr_type, by_row, false);
    }
}

/**********************************/

template<typename T>
NumericMatrix initialize_dense_matrix_internal(size_t nrows, size_t ncols, uintptr_t values, const std::string& type) {
    std::vector<T> tmp(nrows* ncols);
    auto vals = create_SomeNumericArray<T>(values, nrows*ncols, type);
    std::copy(vals.begin(), vals.end(), tmp.begin());
    auto ptr = std::shared_ptr<const tatami::NumericMatrix>(new tatami::DenseColumnMatrix<double, int, decltype(tmp)>(nrows, ncols, std::move(tmp)));
    return NumericMatrix(std::move(ptr));
}

NumericMatrix initialize_dense_matrix(size_t nrows, size_t ncols, uintptr_t values, std::string type, bool force_integer) {
    if (force_integer || is_type_integer(type)) {
        return initialize_dense_matrix_internal<int>(nrows, ncols, values, type); 
    } else {
        return initialize_dense_matrix_internal<double>(nrows, ncols, values, type); 
    }
}

/**********************************/

EMSCRIPTEN_BINDINGS(initialize_sparse_matrix) {
    emscripten::function("initialize_sparse_matrix", &initialize_sparse_matrix, emscripten::return_value_policy::take_ownership());

    emscripten::function("initialize_sparse_matrix_from_dense_vector", &initialize_sparse_matrix_from_dense_vector, emscripten::return_value_policy::take_ownership());

    emscripten::function("initialize_dense_matrix", &initialize_dense_matrix, emscripten::return_value_policy::take_ownership());
}

