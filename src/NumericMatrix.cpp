#include <emscripten/bind.h>
#include "NumericMatrix.h"
#include "JSVector.h"

NumericMatrix::NumericMatrix(const tatami::NumericMatrix* p) : ptr(std::shared_ptr<const tatami::NumericMatrix>(p)), is_reorganized(false) {}

NumericMatrix::NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p) : ptr(std::move(p)), is_reorganized(false) {}

NumericMatrix::NumericMatrix(const tatami::NumericMatrix* p, std::vector<size_t> i) : ptr(std::shared_ptr<const tatami::NumericMatrix>(p)), row_ids(std::move(i)), is_reorganized(true) {
    if (row_ids.size() != ptr->nrow()) {
        throw std::runtime_error("length of 'i' must be equal to the number of rows of 'p'");
    }
}

NumericMatrix::NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p, std::vector<size_t> i) : ptr(std::move(p)), row_ids(std::move(i)), is_reorganized(true) {
    if (row_ids.size() != ptr->nrow()) {
        throw std::runtime_error("length of 'i' must be equal to the number of rows of 'p'");
    }
}

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

void NumericMatrix::identities(uintptr_t values) const {
    int* buffer = reinterpret_cast<int*>(values);
    std::copy(row_ids.begin(), row_ids.end(), buffer);
    return;
}

bool NumericMatrix::reorganized() const {
    return is_reorganized;
}

bool NumericMatrix::sparse() const {
    return ptr->sparse(); 
}

NumericMatrix NumericMatrix::clone() const {
    if (is_reorganized) {
        return NumericMatrix(ptr, row_ids);
    } else {
        return NumericMatrix(ptr);
    }
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(NumericMatrix) {
    emscripten::class_<NumericMatrix>("NumericMatrix")
        .constructor<int, int, uintptr_t>()
        .function("nrow", &NumericMatrix::nrow)
        .function("ncol", &NumericMatrix::ncol)
        .function("row", &NumericMatrix::row)
        .function("column", &NumericMatrix::column)
        .function("identities", &NumericMatrix::identities)
        .function("reorganized", &NumericMatrix::reorganized)
        .function("sparse", &NumericMatrix::sparse)
        .function("clone", &NumericMatrix::clone)
        ;
}
/**
 * @endcond 
 */

