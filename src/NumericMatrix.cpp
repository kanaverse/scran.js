#include <emscripten/bind.h>
#include "NumericMatrix.h"
#include "JSVector.h"

NumericMatrix::NumericMatrix() {}

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

template<class Vector_>
void create_NumericMatrix(int nr, int nc, Vector_ vec, bool colmajor, std::shared_ptr<const tatami::NumericMatrix>& ptr) {
    if (colmajor) {
        ptr.reset(new tatami::DenseColumnMatrix<double, int, Vector_>(nr, nc, std::move(vec)));
    } else {
        ptr.reset(new tatami::DenseRowMatrix<double, int, Vector_>(nr, nc, std::move(vec)));
    }
}

NumericMatrix::NumericMatrix(int nr, int nc, uintptr_t values, bool colmajor, bool copy) {
    size_t product = static_cast<size_t>(nr) * static_cast<size_t>(nc);
    auto iptr = reinterpret_cast<const double*>(values);
    if (!copy) {
        create_NumericMatrix(nr, nc, JSVector<double>(iptr, product), colmajor, ptr);
    } else {
        create_NumericMatrix(nr, nc, std::vector<double>(iptr, iptr + product), colmajor, ptr);
    }
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
    if (!is_reorganized) {
        throw std::runtime_error("cannot retrieve identities for non-reorganized matrix");
    } 

    int* buffer = reinterpret_cast<int*>(values);
    std::copy(row_ids.begin(), row_ids.end(), buffer);
    return;
}

bool NumericMatrix::reorganized() const {
    return is_reorganized;
}

void NumericMatrix::wipe_identities() {
    row_ids.clear();
    row_ids.shrink_to_fit();
    is_reorganized = false;
    return;
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
        .constructor<int, int, uintptr_t, bool, bool>()
        .function("nrow", &NumericMatrix::nrow)
        .function("ncol", &NumericMatrix::ncol)
        .function("row", &NumericMatrix::row)
        .function("column", &NumericMatrix::column)
        .function("identities", &NumericMatrix::identities)
        .function("reorganized", &NumericMatrix::reorganized)
        .function("wipe_identities", &NumericMatrix::wipe_identities)
        .function("sparse", &NumericMatrix::sparse)
        .function("clone", &NumericMatrix::clone)
        ;
}
/**
 * @endcond 
 */

