#include <emscripten/bind.h>

#include "NumericMatrix.h"

#include <cstdint>

#include "tatami/tatami.hpp"
#include "sanisizer/sanisizer.hpp"

NumericMatrix::NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p) : my_ptr(std::move(p)) {}

const std::shared_ptr<const tatami::Matrix<MatrixValue, MatrixIndex> >& NumericMatrix::ptr() const {
    return my_ptr;
}

std::shared_ptr<const tatami::Matrix<MatrixValue, MatrixIndex> >& NumericMatrix::ptr() {
    return my_ptr;
}

const tatami::Matrix<MatrixValue, MatrixIndex>& NumericMatrix::operator*() const {
    return *my_ptr;
}

void NumericMatrix::reset_ptr(std::shared_ptr<const tatami::NumericMatrix> p) {
    my_ptr = std::move(p);
    my_by_row.reset();
    my_by_column.reset();
}

MatrixIndex NumericMatrix::nrow() const {
    return my_ptr->nrow();
}

MatrixIndex NumericMatrix::ncol() const {
    return my_ptr->ncol();
}

JsFakeInt NumericMatrix::js_nrow() const {
    return int2js(my_ptr->nrow());
}

JsFakeInt NumericMatrix::js_ncol() const {
    return int2js(my_ptr->ncol());
}

void NumericMatrix::js_row(JsFakeInt r_raw, JsFakeInt values_raw) {
    const auto values = js2int<std::uintptr_t>(values_raw);
    MatrixValue* buffer = reinterpret_cast<MatrixValue*>(values);
    if (!my_by_row) {
        my_by_row = my_ptr->dense_row();
    }
    auto out = my_by_row->fetch(js2int<MatrixIndex>(r_raw), buffer);
    tatami::copy_n(out, my_ptr->ncol(), buffer);
    return;
}

void NumericMatrix::js_column(JsFakeInt c_raw, JsFakeInt values_raw) {
    const auto values = js2int<std::uintptr_t>(values_raw);
    MatrixValue* buffer = reinterpret_cast<MatrixValue*>(values);
    if (!my_by_column) {
        my_by_column = my_ptr->dense_column();
    }
    auto out = my_by_column->fetch(js2int<MatrixIndex>(c_raw), buffer);
    tatami::copy_n(out, my_ptr->nrow(), buffer);
    return;
}

bool NumericMatrix::js_sparse() const {
    return my_ptr->sparse(); 
}

NumericMatrix NumericMatrix::js_clone() const {
    return NumericMatrix(my_ptr);
}

EMSCRIPTEN_BINDINGS(NumericMatrix) {
    emscripten::class_<NumericMatrix>("NumericMatrix")
        .function("nrow", &NumericMatrix::js_nrow, emscripten::return_value_policy::take_ownership())
        .function("ncol", &NumericMatrix::js_ncol, emscripten::return_value_policy::take_ownership())
        .function("row", &NumericMatrix::js_row, emscripten::return_value_policy::take_ownership())
        .function("column", &NumericMatrix::js_column, emscripten::return_value_policy::take_ownership())
        .function("sparse", &NumericMatrix::js_sparse, emscripten::return_value_policy::take_ownership())
        .function("clone", &NumericMatrix::js_clone, emscripten::return_value_policy::take_ownership())
        ;
}
