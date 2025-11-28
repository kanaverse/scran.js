#include <emscripten/bind.h>

#include "NumericMatrix.h"

#include <cstdint>
#include <cstddef>
#include <stdexcept>
#include <unordered_map>

#include "rds_utils.h"
#include "read_utils.h"
#include "utils.h"

#include "tatami/tatami.hpp"

std::pair<MatrixIndex, MatrixIndex> parse_dimensions(const rds2cpp::RObject* dimobj) {
    if (dimobj->type() != rds2cpp::SEXPType::INT) {
        throw std::runtime_error("expected matrix dimensions to be integer");
    }

    auto dimvec = static_cast<const rds2cpp::IntegerVector*>(dimobj);
    const auto& dims = dimvec->data;
    if (dims.size() != 2) {
        throw std::runtime_error("expected matrix dimensions to be of length 2");
    }
    if (dims[0] < 0 || dims[1] < 0) {
        throw std::runtime_error("expected all matrix dimensions to be non-negative");
    }

    return std::make_pair(
        sanisizer::cast<MatrixIndex>(dims[0]),
        sanisizer::cast<MatrixIndex>(dims[1])
    );
}

template<class Vector_>
std::pair<MatrixIndex, MatrixIndex> fetch_array_dimensions(const Vector_* obj) {
    const auto& attr = obj->attributes.names;

    bool found = false;
    const auto nattr = attr.size();
    I<decltype(nattr)> adx = 0;
    for (; adx < nattr; ++adx) {
        if (attr[adx] == "dim") {
            found = true;
            break;
        }
    }
    if (!found) {
        throw std::runtime_error("expected a 'dim' attribute for an ordinary array");
    }

    const auto& attrval = obj->attributes.values[adx];
    return parse_dimensions(attrval.get());
}

template<typename Type_, class Vector_>
NumericMatrix convert_ordinary_array_to_sparse_matrix(const Vector_* obj, bool layered) {
    auto dims = fetch_array_dimensions(obj);
    tatami::ArrayView view(obj->data.data(), obj->data.size());
    tatami::DenseColumnMatrix<Type_, MatrixIndex, I<decltype(view)> > raw(dims.first, dims.second, std::move(view));
    return sparse_from_tatami(raw, layered);
}

template<typename Type_>
NumericMatrix convert_dgCMatrix_to_sparse_matrix(rds2cpp::S4Object* obj, bool layered) {
    std::unordered_map<std::string, rds2cpp::RObject*> by_name;
    const auto nattr = obj->attributes.names.size();
    for (I<decltype(nattr)> a = 0; a < nattr; ++a) {
        by_name[obj->attributes.names[a]] = obj->attributes.values[a].get();
    }

    auto dimIt = by_name.find("Dim");
    if (dimIt == by_name.end()) {
        throw std::runtime_error("expected a 'Dim' slot for a dgCMatrix object");
    }
    auto dims = parse_dimensions(dimIt->second);

    auto xIt = by_name.find("x");
    if (xIt == by_name.end()) {
        throw std::runtime_error("expected a 'x' slot for a dgCMatrix object");
    }
    auto xobj = xIt->second;
    if (xobj->type() != rds2cpp::SEXPType::REAL) {
        throw std::runtime_error("expected 'x' slot to be a double-precision vector");
    }
    auto& x = static_cast<rds2cpp::DoubleVector*>(xobj)->data; 

    auto iIt = by_name.find("i");
    if (iIt == by_name.end()) {
        throw std::runtime_error("expected a 'i' slot for a dgCMatrix object");
    }
    auto iobj = iIt->second;
    if (iobj->type() != rds2cpp::SEXPType::INT) {
        throw std::runtime_error("expected 'i' slot to be an integer vector");
    }
    auto& i = static_cast<rds2cpp::IntegerVector*>(iobj)->data; 

    auto pIt = by_name.find("p");
    if (pIt == by_name.end()) {
        throw std::runtime_error("expected a 'p' slot for a dgCMatrix object");
    }
    auto pobj = pIt->second;
    if (pobj->type() != rds2cpp::SEXPType::INT) {
        throw std::runtime_error("expected 'p' slot to be an integer vector");
    }
    auto& p = static_cast<rds2cpp::IntegerVector*>(pobj)->data; 

    tatami::ArrayView xview(x.data(), x.size());
    tatami::ArrayView iview(i.data(), i.size());
    tatami::ArrayView pview(p.data(), p.size());
    tatami::CompressedSparseColumnMatrix<Type_, MatrixIndex, decltype(xview), decltype(iview), decltype(pview)> mat(
        dims.first,
        dims.second,
        std::move(xview),
        std::move(iview),
        std::move(pview)
    );

    return sparse_from_tatami(mat, layered);
}

template<typename Type_>
NumericMatrix convert_dgTMatrix_to_sparse_matrix(rds2cpp::S4Object* obj, bool layered) {
    std::unordered_map<std::string, rds2cpp::RObject*> by_name;
    const auto nattr = obj->attributes.names.size();
    for (I<decltype(nattr)> a = 0; a < nattr; ++a) {
        by_name[obj->attributes.names[a]] = obj->attributes.values[a].get();
    }

    auto dimIt = by_name.find("Dim");
    if (dimIt == by_name.end()) {
        throw std::runtime_error("expected a 'Dim' slot for a dgCMatrix object");
    }
    auto dims = parse_dimensions(dimIt->second);

    auto xIt = by_name.find("x");
    if (xIt == by_name.end()) {
        throw std::runtime_error("expected a 'x' slot for a dgCMatrix object");
    }
    auto xobj = xIt->second;
    if (xobj->type() != rds2cpp::SEXPType::REAL) {
        throw std::runtime_error("expected 'x' slot to be a double-precision vector");
    }
    const auto& x = static_cast<rds2cpp::DoubleVector*>(xobj)->data; 

    auto iIt = by_name.find("i");
    if (iIt == by_name.end()) {
        throw std::runtime_error("expected a 'i' slot for a dgCMatrix object");
    }
    auto iobj = iIt->second;
    if (iobj->type() != rds2cpp::SEXPType::INT) {
        throw std::runtime_error("expected 'i' slot to be an integer vector");
    }
    const auto& i = static_cast<rds2cpp::IntegerVector*>(iobj)->data; 

    auto jIt = by_name.find("j");
    if (jIt == by_name.end()) {
        throw std::runtime_error("expected a 'j' slot for a dgCMatrix object");
    }
    auto jobj = jIt->second;
    if (jobj->type() != rds2cpp::SEXPType::INT) {
        throw std::runtime_error("expected 'j' slot to be an integer vector");
    }
    const auto& j = static_cast<rds2cpp::IntegerVector*>(jobj)->data; 

    auto xcopy = x;
    auto icopy = i;
    auto jcopy = j;
    auto p = tatami::compress_sparse_triplets<false>(dims.first, dims.second, xcopy, icopy, jcopy);

    tatami::CompressedSparseColumnMatrix<Type_, MatrixIndex, I<decltype(xcopy)>, I<decltype(icopy)>, I<decltype(p)> > mat(
        dims.first,
        dims.second,
        std::move(xcopy),
        std::move(icopy),
        std::move(p)
    );

    return sparse_from_tatami(mat, layered);
}

NumericMatrix initialize_from_rds(JsFakeInt ptr_raw, bool force_integer, bool layered) {
    RdsObject* wrapper = reinterpret_cast<RdsObject*>(js2int<std::uintptr_t>(ptr_raw));
    auto obj = wrapper->ptr;

    if (obj->type() == rds2cpp::SEXPType::INT) {
        auto ivec = static_cast<const rds2cpp::IntegerVector*>(obj);
        return convert_ordinary_array_to_sparse_matrix<std::int32_t>(ivec, layered);
    }

    if (obj->type() == rds2cpp::SEXPType::REAL) {
        auto dvec = static_cast<const rds2cpp::DoubleVector*>(obj);
        if (force_integer) {
            return convert_ordinary_array_to_sparse_matrix<std::int32_t>(dvec, layered);
        } else {
            return convert_ordinary_array_to_sparse_matrix<double>(dvec, false);
        }
    }

    if (obj->type() != rds2cpp::SEXPType::S4) {
        throw std::runtime_error("RDS file must contain an ordinary array or an S4 class");
    }

    auto s4 = static_cast<rds2cpp::S4Object*>(const_cast<rds2cpp::RObject*>(obj));
    if (s4->class_name == "dgCMatrix") {
        if (force_integer) {
            return convert_dgCMatrix_to_sparse_matrix<std::int32_t>(s4, layered);
        } else {
            return convert_dgCMatrix_to_sparse_matrix<double>(s4, false);
        }
    }

    if (s4->class_name != "dgTMatrix") {
        throw std::runtime_error("S4 object in an RDS file must be a dgTMatrix");
    }
    if (force_integer) {
        return convert_dgTMatrix_to_sparse_matrix<std::int32_t>(s4, layered); 
    } else {
        return convert_dgTMatrix_to_sparse_matrix<double>(s4, false);
    }
}

EMSCRIPTEN_BINDINGS(initialize_from_rds) {
    emscripten::function("initialize_from_rds", &initialize_from_rds, emscripten::return_value_policy::take_ownership());
}
