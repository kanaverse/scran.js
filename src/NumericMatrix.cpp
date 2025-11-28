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

JsFakeInt NumericMatrix::nrow_js() const {
    return int2js(my_ptr->nrow());
}

JsFakeInt NumericMatrix::ncol_js() const {
    return int2js(my_ptr->ncol());
}

void NumericMatrix::row(JsFakeInt r_raw, std::uintptr_t values) {
    MatrixValue* buffer = reinterpret_cast<MatrixValue*>(values);
    if (!my_by_row) {
        my_by_row = my_ptr->dense_row();
    }
    auto out = my_by_row->fetch(js2int<MatrixIndex>(r_raw), buffer);
    tatami::copy_n(out, my_ptr->ncol(), buffer);
    return;
}

void NumericMatrix::column(JsFakeInt c_raw, std::uintptr_t values) {
    MatrixValue* buffer = reinterpret_cast<MatrixValue*>(values);
    if (!my_by_column) {
        my_by_column = my_ptr->dense_column();
    }
    auto out = my_by_column->fetch(js2int<MatrixIndex>(c_raw), buffer);
    tatami::copy_n(out, my_ptr->nrow(), buffer);
    return;
}

bool NumericMatrix::sparse() const {
    return my_ptr->sparse(); 
}

NumericMatrix NumericMatrix::clone() const {
    return NumericMatrix(my_ptr);
}

EMSCRIPTEN_BINDINGS(NumericMatrix) {
    emscripten::class_<NumericMatrix>("NumericMatrix")
        .function("nrow", &NumericMatrix::nrow_js, emscripten::return_value_policy::take_ownership())
        .function("ncol", &NumericMatrix::ncol_js, emscripten::return_value_policy::take_ownership())
        .function("row", &NumericMatrix::row, emscripten::return_value_policy::take_ownership())
        .function("column", &NumericMatrix::column, emscripten::return_value_policy::take_ownership())
        .function("sparse", &NumericMatrix::sparse, emscripten::return_value_policy::take_ownership())
        .function("clone", &NumericMatrix::clone, emscripten::return_value_policy::take_ownership())
        ;
}
