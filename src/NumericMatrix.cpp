#include <emscripten/bind.h>
#include "NumericMatrix.h"
#include "JSVector.h"

NumericMatrix::NumericMatrix(const tatami::NumericMatrix* p) : ptr(std::shared_ptr<const tatami::NumericMatrix>(p)) {}

NumericMatrix::NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p) : ptr(std::move(p)) {}

NumericMatrix::NumericMatrix(const tatami::NumericMatrix* p, std::vector<size_t> perm) : ptr(std::shared_ptr<const tatami::NumericMatrix>(p)), permutation(std::move(perm)) {}

NumericMatrix::NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p, std::vector<size_t> perm) : ptr(std::move(p)), permutation(std::move(perm)) {}

NumericMatrix::NumericMatrix(int nr, int nc, uintptr_t values) {
    JSVector<double> thing(reinterpret_cast<const double*>(values), nr*nc);
    ptr = std::shared_ptr<tatami::NumericMatrix>(new tatami::DenseRowMatrix<double, int, decltype(thing)>(nr, nc, thing));
    return;
}

int NumericMatrix::nrow() const {
    return ptr->nrow();
}

int NumericMatrix::ncol() const {
    return ptr->ncol();
}

void NumericMatrix::row(int r, uintptr_t values) const {
    double* buffer = reinterpret_cast<double*>(values);
    ptr->row_copy(r, buffer);
    return;
}

void NumericMatrix::column(int c, uintptr_t values) const {
    double* buffer = reinterpret_cast<double*>(values);
    ptr->column_copy(c, buffer);
    return;
}

void NumericMatrix::perm(uintptr_t values) const {
    int* buffer = reinterpret_cast<int*>(values);
    std::copy(permutation.begin(), permutation.end(), buffer);
    return;
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(my_class_example) {
    emscripten::class_<NumericMatrix>("NumericMatrix")
        .constructor<int, int, uintptr_t>()
        .function("nrow", &NumericMatrix::nrow)
        .function("ncol", &NumericMatrix::ncol)
        .function("row", &NumericMatrix::row)
        .function("column", &NumericMatrix::column)
        .function("permutation", &NumericMatrix::perm)
        ;
}
/**
 * @endcond 
 */

