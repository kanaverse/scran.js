#include <emscripten/bind.h>
#include "NumericMatrix.h"

NumericMatrix::NumericMatrix() {}

NumericMatrix::NumericMatrix(const tatami::NumericMatrix* p) : ptr(p) {}

NumericMatrix::NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p) : ptr(std::move(p)) {}

template<class Vector_>
tatami::NumericMatrix* create_NumericMatrix(int nr, int nc, Vector_ vec, bool colmajor) {
    if (colmajor) {
        return new tatami::DenseColumnMatrix<double, int, Vector_>(nr, nc, std::move(vec));
    } else {
        return new tatami::DenseRowMatrix<double, int, Vector_>(nr, nc, std::move(vec));
    }
}

void NumericMatrix::reset_ptr(std::shared_ptr<const tatami::NumericMatrix> p) {
    ptr = std::move(p);
    by_row.reset();
    by_column.reset();
}

NumericMatrix::NumericMatrix(int nr, int nc, uintptr_t values, bool colmajor, bool copy) {
    size_t product = static_cast<size_t>(nr) * static_cast<size_t>(nc);
    auto iptr = reinterpret_cast<const double*>(values);
    if (!copy) {
        reset_ptr(std::shared_ptr<const tatami::NumericMatrix>(create_NumericMatrix(nr, nc, tatami::ArrayView<double>(iptr, product), colmajor)));
    } else {
        reset_ptr(std::shared_ptr<const tatami::NumericMatrix>(create_NumericMatrix(nr, nc, std::vector<double>(iptr, iptr + product), colmajor)));
    }
}

int NumericMatrix::nrow() const {
    return ptr->nrow();
}

int NumericMatrix::ncol() const {
    return ptr->ncol();
}

void NumericMatrix::row(int r, uintptr_t values) {
    double* buffer = reinterpret_cast<double*>(values);
    if (!by_row) {
        by_row = ptr->dense_row();
    }
    by_row->fetch_copy(r, buffer);
    return;
}

void NumericMatrix::column(int c, uintptr_t values) {
    double* buffer = reinterpret_cast<double*>(values);
    if (!by_column) {
        by_column = ptr->dense_column();
    }
    by_column->fetch_copy(c, buffer);
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
        .constructor<int, int, uintptr_t, bool, bool>(emscripten::return_value_policy::take_ownership())
        .function("nrow", &NumericMatrix::nrow, emscripten::return_value_policy::take_ownership())
        .function("ncol", &NumericMatrix::ncol, emscripten::return_value_policy::take_ownership())
        .function("row", &NumericMatrix::row, emscripten::return_value_policy::take_ownership())
        .function("column", &NumericMatrix::column, emscripten::return_value_policy::take_ownership())
        .function("sparse", &NumericMatrix::sparse, emscripten::return_value_policy::take_ownership())
        .function("clone", &NumericMatrix::clone, emscripten::return_value_policy::take_ownership())
        ;
}
