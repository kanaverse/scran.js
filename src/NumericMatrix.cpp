#include <emscripten/bind.h>
#include "NumericMatrix.h"

NumericMatrix::NumericMatrix() {}

NumericMatrix::NumericMatrix(const tatami::NumericMatrix* p) : ptr(p) {}

NumericMatrix::NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p) : ptr(std::move(p)) {}

void NumericMatrix::reset_ptr(std::shared_ptr<const tatami::NumericMatrix> p) {
    ptr = std::move(p);
    by_row.reset();
    by_column.reset();
}

int32_t NumericMatrix::nrow() const {
    return ptr->nrow();
}

int32_t NumericMatrix::ncol() const {
    return ptr->ncol();
}

void NumericMatrix::row(int32_t r, uintptr_t values) {
    double* buffer = reinterpret_cast<double*>(values);
    if (!by_row) {
        by_row = ptr->dense_row();
    }
    auto out = by_row->fetch(r, buffer);
    tatami::copy_n(out, ptr->ncol(), buffer);
    return;
}

void NumericMatrix::column(int32_t c, uintptr_t values) {
    double* buffer = reinterpret_cast<double*>(values);
    if (!by_column) {
        by_column = ptr->dense_column();
    }
    auto out = by_column->fetch(c, buffer);
    tatami::copy_n(out, ptr->nrow(), buffer);
    return;
}

bool NumericMatrix::sparse() const {
    return ptr->sparse(); 
}

NumericMatrix NumericMatrix::clone() const {
    return NumericMatrix(ptr);
}

EMSCRIPTEN_BINDINGS(NumericMatrix) {
    emscripten::class_<NumericMatrix>("NumericMatrix")
        .function("nrow", &NumericMatrix::nrow, emscripten::return_value_policy::take_ownership())
        .function("ncol", &NumericMatrix::ncol, emscripten::return_value_policy::take_ownership())
        .function("row", &NumericMatrix::row, emscripten::return_value_policy::take_ownership())
        .function("column", &NumericMatrix::column, emscripten::return_value_policy::take_ownership())
        .function("sparse", &NumericMatrix::sparse, emscripten::return_value_policy::take_ownership())
        .function("clone", &NumericMatrix::clone, emscripten::return_value_policy::take_ownership())
        ;
}
