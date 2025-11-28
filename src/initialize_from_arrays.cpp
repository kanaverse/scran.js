#include <emscripten/bind.h>
#include <cstdint>
#include <cstddef>
#include <string>
#include <stdexcept>
#include <vector>

#include "NumericMatrix.h"
#include "read_utils.h"
#include "utils.h"

#include "tatami/tatami.hpp"

template<typename Type_>
tatami::SomeNumericArray<Type_> create_SomeNumericArray(JsFakeInt ptr_raw, std::size_t len, const std::string& type) {
    tatami::SomeNumericType t;

    if (type == "Int8Array") {
        t = tatami::SomeNumericType::I8;
    } else if (type == "Uint8Array") {
        t = tatami::SomeNumericType::U8;
    } else if (type == "Int16Array") {
        t = tatami::SomeNumericType::I16;
    } else if (type == "Uint16Array") {
        t = tatami::SomeNumericType::U16;
    } else if (type == "Int32Array") {
        t = tatami::SomeNumericType::I32;
    } else if (type == "Uint32Array") {
        t = tatami::SomeNumericType::U32;
    } else if (type == "BigInt64Array") {
        t = tatami::SomeNumericType::I64;
    } else if (type == "BigUint64Array") {
        t = tatami::SomeNumericType::U64;
    } else if (type == "Float32Array") {
        t = tatami::SomeNumericType::F32;
    } else if (type == "Float64Array") {
        t = tatami::SomeNumericType::F64;
    } else {
        throw std::runtime_error("unknown array type '" + type + "'");
    }

    const auto ptr = js2int<std::uintptr_t>(ptr_raw);
    return tatami::SomeNumericArray<Type_>(reinterpret_cast<void*>(ptr), len, t);
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

template<typename Type_>
NumericMatrix initialize_sparse_matrix_internal(
    JsFakeInt nrows_raw,
    JsFakeInt ncols_raw,
    JsFakeInt nelements_raw, 
    JsFakeInt values_raw,
    const std::string& value_type,
    JsFakeInt indices_raw,
    const std::string& index_type,
    JsFakeInt indptrs_raw,
    const std::string& indptrs_type,
    bool by_row,
    bool layered
) {
    const auto nrows = js2int<MatrixIndex>(nrows_raw);
    const auto ncols = js2int<MatrixIndex>(ncols_raw);
    const auto nelements = js2int<std::size_t>(nelements_raw);
    auto val = create_SomeNumericArray<Type_>(values_raw, nelements, value_type);
    auto idx = create_SomeNumericArray<std::int32_t>(indices_raw, nelements, index_type);

    if (by_row && !layered) {
        // Directly creating a CSR matrix.
        auto ind = create_SomeNumericArray<std::size_t>(indptrs_raw, sanisizer::sum<std::size_t>(nrows, 1), indptrs_type);
        return copy_into_sparse<Type_>(nrows, ncols, val, idx, ind);
    } else {
        std::shared_ptr<tatami::Matrix<Type_, MatrixIndex> > mat;
        if (by_row) {
            auto ind = create_SomeNumericArray<std::size_t>(indptrs_raw, sanisizer::sum<std::size_t>(nrows, 1), indptrs_type);
            mat.reset(new tatami::CompressedSparseRowMatrix<Type_, MatrixIndex, I<decltype(val)>, I<decltype(idx)>, I<decltype(ind)> >(nrows, ncols, val, idx, ind));
        } else {
            auto ind = create_SomeNumericArray<std::size_t>(indptrs_raw, sanisizer::sum<std::size_t>(ncols, 1), indptrs_type);
            mat.reset(new tatami::CompressedSparseColumnMatrix<Type_, MatrixIndex, I<decltype(val)>, I<decltype(idx)>, I<decltype(ind)> >(nrows, ncols, val, idx, ind));
        }
        return sparse_from_tatami(*mat, layered);
    }
}

NumericMatrix initialize_from_sparse_arrays(
    JsFakeInt nrows_raw,
    JsFakeInt ncols_raw,
    JsFakeInt nelements_raw, 
    JsFakeInt values_raw,
    std::string value_type,
    JsFakeInt indices_raw,
    std::string index_type,
    JsFakeInt indptrs_raw,
    std::string indptrs_type,
    bool by_row,
    bool force_integer,
    bool layered
) {
    if (force_integer || is_type_integer(value_type)) {
        return initialize_sparse_matrix_internal<std::int32_t>(nrows_raw, ncols_raw, nelements_raw, values_raw, value_type, indices_raw, index_type, indptrs_raw, indptrs_type, by_row, layered);
    } else {
        return initialize_sparse_matrix_internal<double>(nrows_raw, ncols_raw, nelements_raw, values_raw, value_type, indices_raw, index_type, indptrs_raw, indptrs_type, by_row, false);
    }
}

/**********************************/

template<typename Type_>
NumericMatrix initialize_sparse_matrix_from_dense_vector_internal(
    JsFakeInt nrows_raw,
    JsFakeInt ncols_raw,
    JsFakeInt values_raw,
    const std::string& type,
    bool column_major,
    bool layered
) {
    const auto nrows = js2int<MatrixIndex>(nrows_raw);
    const auto ncols = js2int<MatrixIndex>(ncols_raw);
    auto vals = create_SomeNumericArray<Type_>(values_raw, sanisizer::product<std::size_t>(nrows, ncols), type);
    tatami::DenseMatrix<Type_, MatrixIndex, I<decltype(vals)> > mat(nrows, ncols, vals, !column_major);
    return sparse_from_tatami(mat, layered);
}

NumericMatrix initialize_sparse_matrix_from_dense_array(
    JsFakeInt nrows_raw,
    JsFakeInt ncols_raw,
    JsFakeInt values_raw,
    std::string type,
    bool column_major,
    bool force_integer,
    bool layered
) {
    if (force_integer || is_type_integer(type)) {
        return initialize_sparse_matrix_from_dense_vector_internal<std::int32_t>(nrows_raw, ncols_raw, values_raw, type, column_major, layered);
    } else {
        return initialize_sparse_matrix_from_dense_vector_internal<double>(nrows_raw, ncols_raw, values_raw, type, column_major, false);
    }
}

template<typename Type_>
NumericMatrix initialize_dense_matrix_internal(
    JsFakeInt nrows_raw,
    JsFakeInt ncols_raw,
    JsFakeInt values_raw,
    const std::string& type,
    bool column_major
) {
    const auto nrows = js2int<MatrixIndex>(nrows_raw);
    const auto ncols = js2int<MatrixIndex>(ncols_raw);
    const auto len = sanisizer::product<std::size_t>(nrows, ncols);
    auto vals = create_SomeNumericArray<Type_>(values_raw, len, type);
    auto tmp = sanisizer::create<std::vector<Type_> >(len);
    std::copy(vals.begin(), vals.end(), tmp.begin());
    auto ptr = std::shared_ptr<const tatami::NumericMatrix>(new tatami::DenseMatrix<double, MatrixIndex, I<decltype(tmp)> >(nrows, ncols, std::move(tmp), !column_major));
    return NumericMatrix(std::move(ptr));
}

NumericMatrix initialize_dense_matrix_from_dense_array(
    JsFakeInt nrows_raw,
    JsFakeInt ncols_raw,
    JsFakeInt values_raw,
    std::string type,
    bool column_major,
    bool force_integer
) {
    if (force_integer || is_type_integer(type)) {
        return initialize_dense_matrix_internal<MatrixIndex>(nrows_raw, ncols_raw, values_raw, type, column_major); 
    } else {
        return initialize_dense_matrix_internal<double>(nrows_raw, ncols_raw, values_raw, type, column_major); 
    }
}

/**********************************/

EMSCRIPTEN_BINDINGS(initialize_from_arrays) {
    emscripten::function("initialize_dense_matrix_from_dense_array", &initialize_dense_matrix_from_dense_array, emscripten::return_value_policy::take_ownership());
    emscripten::function("initialize_sparse_matrix_from_dense_array", &initialize_sparse_matrix_from_dense_array, emscripten::return_value_policy::take_ownership());
    emscripten::function("initialize_from_sparse_arrays", &initialize_from_sparse_arrays, emscripten::return_value_policy::take_ownership());
}
