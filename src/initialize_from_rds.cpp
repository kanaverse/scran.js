#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "parallel.h"

#include "rds_utils.h"
#include "read_utils.h"
#include "tatami/tatami.hpp"
#include "tatami/ext/ArrayView.hpp"

#include <unordered_map>

std::pair<size_t, size_t> parse_dimensions(const rds2cpp::RObject* dimobj) {
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

    return std::pair<size_t, size_t>(dims[0], dims[1]);
}

template<class Vector>
std::pair<size_t, size_t> fetch_array_dimensions(const Vector* obj) {
    const auto& attr = obj->attributes.names;

    bool found = false;
    size_t adx;
    for (size_t a = 0; a < attr.size(); ++a) {
        if (attr[a] == "dim") {
            found = true;
            adx = a;
            break;
        }
    }
    if (!found) {
        throw std::runtime_error("expected a 'dim' attribute for an ordinary array");
    }

    const auto& attrval = obj->attributes.values[adx];
    return parse_dimensions(attrval.get());
}


template<class Vector>
NumericMatrix convert_ordinary_array_to_sparse_matrix(const Vector* obj, bool layered) {
    auto dims = fetch_array_dimensions(obj);
    tatami::ArrayView view(obj->data.data(), obj->data.size());

    typedef typename std::remove_reference<decltype(obj->data)>::type V;
    typedef tatami::DenseColumnMatrix<typename V::value_type, int, decltype(view)> Matrix;
    Matrix raw(dims.first, dims.second, std::move(view));

    return sparse_from_tatami(&raw, layered);
}

NumericMatrix convert_dgCMatrix_to_sparse_matrix(rds2cpp::S4Object* obj, bool layered, bool consume) {
    std::unordered_map<std::string, rds2cpp::RObject*> by_name;
    size_t nattr = obj->attributes.names.size();
    for (size_t a = 0; a < nattr; ++a) {
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

    if (!layered && consume) {
        typedef typename std::remove_reference<decltype(x)>::type XType;
        typedef typename std::remove_reference<decltype(i)>::type IType;
        typedef typename std::remove_reference<decltype(p)>::type PType;
        typedef tatami::CompressedSparseColumnMatrix<double, int, XType, IType, PType> Matrix;
        return NumericMatrix(new Matrix(dims.first, dims.second, std::move(x), std::move(i), std::move(p)));
    } else {
        tatami::ArrayView xview(x.data(), x.size());
        tatami::ArrayView iview(i.data(), i.size());
        tatami::ArrayView pview(p.data(), p.size());
        tatami::CompressedSparseColumnMatrix<double, int, decltype(xview), decltype(iview), decltype(pview)> mat(dims.first, dims.second, std::move(xview), std::move(iview), std::move(pview));
        return sparse_from_tatami(&mat, layered);
    }
}

NumericMatrix convert_dgTMatrix_to_sparse_matrix(rds2cpp::S4Object* obj, bool layered, bool consume) {
    std::unordered_map<std::string, rds2cpp::RObject*> by_name;
    size_t nattr = obj->attributes.names.size();
    for (size_t a = 0; a < nattr; ++a) {
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

    auto jIt = by_name.find("j");
    if (jIt == by_name.end()) {
        throw std::runtime_error("expected a 'j' slot for a dgCMatrix object");
    }
    auto jobj = jIt->second;
    if (jobj->type() != rds2cpp::SEXPType::INT) {
        throw std::runtime_error("expected 'j' slot to be an integer vector");
    }
    auto& j = static_cast<rds2cpp::IntegerVector*>(jobj)->data; 

    typedef typename std::remove_reference<decltype(x)>::type XType;
    typedef typename std::remove_reference<decltype(i)>::type IType;
    typedef std::vector<size_t> PType;
    typedef tatami::CompressedSparseColumnMatrix<double, int, XType, IType, PType> Matrix;
    std::shared_ptr<tatami::NumericMatrix> mptr;

    if (consume) {
        auto p = tatami::compress_sparse_triplets<false>(dims.first, dims.second, x, i, j);
        mptr.reset(new Matrix(dims.first, dims.second, std::move(x), std::move(i), std::move(p)));
    } else {
        auto xcopy = x;
        auto icopy = i;
        auto jcopy = j;
        auto p = tatami::compress_sparse_triplets<false>(dims.first, dims.second, xcopy, icopy, jcopy);
        mptr.reset(new Matrix(dims.first, dims.second, std::move(xcopy), std::move(icopy), std::move(p)));
    }

    if (!layered) {
        return NumericMatrix(std::move(mptr));
    } else {
        return sparse_from_tatami(mptr.get(), true);
    }
}

NumericMatrix initialize_sparse_matrix_from_rds(uintptr_t ptr, bool layered, bool consume) {
    RdsObject* wrapper = reinterpret_cast<RdsObject*>(ptr);
    auto obj = wrapper->ptr;

    if (obj->type() == rds2cpp::SEXPType::INT) {
        auto ivec = static_cast<const rds2cpp::IntegerVector*>(obj);
        return convert_ordinary_array_to_sparse_matrix(ivec, layered);
    }

    if (obj->type() == rds2cpp::SEXPType::REAL) {
        auto dvec = static_cast<const rds2cpp::DoubleVector*>(obj);
        return convert_ordinary_array_to_sparse_matrix(dvec, layered);
    }

    if (obj->type() != rds2cpp::SEXPType::S4) {
        throw std::runtime_error("RDS file must contain an ordinary array or an S4 class");
    }

    auto s4 = static_cast<rds2cpp::S4Object*>(const_cast<rds2cpp::RObject*>(obj));
    if (s4->class_name == "dgCMatrix") {
        return convert_dgCMatrix_to_sparse_matrix(s4, layered, consume);
    }

    if (s4->class_name != "dgTMatrix") {
        throw std::runtime_error("S4 object in an RDS file must be a dgTMatrix");
    }
    return convert_dgTMatrix_to_sparse_matrix(s4, layered, consume);
}

EMSCRIPTEN_BINDINGS(initialize_from_rds) {
    emscripten::function("initialize_sparse_matrix_from_rds", &initialize_sparse_matrix_from_rds);
}
