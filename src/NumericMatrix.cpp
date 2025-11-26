#include <emscripten/bind.h>

#include "NumericMatrix.h"

#include <cstdint>

#include "tatami/tatami.hpp"
#include "sanisizer/sanisizer.hpp"

NumericMatrix::NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p) : my_ptr(std::move(p)) {}

const std::shared_ptr<const tatami::Matrix<double, std::int32_t> >& NumericMatrix::ptr() const {
    return my_ptr;
}

std::shared_ptr<const tatami::Matrix<double, std::int32_t> >& NumericMatrix::ptr() {
    return my_ptr;
}

const tatami::Matrix<double, std::int32_t>& NumericMatrix::operator*() const {
    return *my_ptr;
}

void NumericMatrix::reset_ptr(std::shared_ptr<const tatami::NumericMatrix> p) {
    my_ptr = std::move(p);
    my_by_row.reset();
    my_by_column.reset();
}

std::int32_t NumericMatrix::nrow() const {
    return my_ptr->nrow();
}

std::int32_t NumericMatrix::ncol() const {
    return my_ptr->ncol();
}

double NumericMatrix::nrow_dbl() const {
    return sanisizer::to_float<double>(my_ptr->nrow());
}

double NumericMatrix::ncol_dbl() const {
    return sanisizer::to_float<double>(my_ptr->ncol());
}

void NumericMatrix::row(std::int32_t r, std::uintptr_t values) {
    double* buffer = reinterpret_cast<double*>(values);
    if (!my_by_row) {
        my_by_row = my_ptr->dense_row();
    }
    auto out = my_by_row->fetch(r, buffer);
    tatami::copy_n(out, my_ptr->ncol(), buffer);
    return;
}

void NumericMatrix::column(std::int32_t c, std::uintptr_t values) {
    double* buffer = reinterpret_cast<double*>(values);
    if (!my_by_column) {
        my_by_column = my_ptr->dense_column();
    }
    auto out = my_by_column->fetch(c, buffer);
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
        .function("nrow", &NumericMatrix::nrow_dbl, emscripten::return_value_policy::take_ownership())
        .function("ncol", &NumericMatrix::ncol_dbl, emscripten::return_value_policy::take_ownership())
        .function("row", &NumericMatrix::row, emscripten::return_value_policy::take_ownership())
        .function("column", &NumericMatrix::column, emscripten::return_value_policy::take_ownership())
        .function("sparse", &NumericMatrix::sparse, emscripten::return_value_policy::take_ownership())
        .function("clone", &NumericMatrix::clone, emscripten::return_value_policy::take_ownership())
        ;
}
