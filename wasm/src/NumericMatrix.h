#ifndef NUMERIC_MATRIX_H
#define NUMERIC_MATRIX_H

#include "JSVector.h"
#include "tatami/tatami.h"

struct NumericMatrix {
    NumericMatrix(int nr, int nc, uintptr_t values) {
        JSVector<double> thing(reinterpret_cast<const double*>(values), nr*nc);
        ptr = std::shared_ptr<tatami::numeric_matrix>(new tatami::DenseRowMatrix<double, int, decltype(thing)>(nr, nc, thing));
        return;
    }

    int nrow() const {
        return ptr->nrow();
    }

    int ncol() const {
        return ptr->ncol();
    }

    void row(int r, uintptr_t values) {
        double* buffer = reinterpret_cast<double*>(values);
        auto out = ptr->row(r, buffer);
        if (out != buffer) {
            std::copy(out, out + ptr->ncol(), buffer);
        }
        return;
    }

    void column(int c, uintptr_t values) {
        double* buffer = reinterpret_cast<double*>(values);
        auto out = ptr->column(c, buffer);
        if (out != buffer) {
            std::copy(out, out + ptr->nrow(), buffer);
        }
        return;
    }

    std::shared_ptr<tatami::numeric_matrix> ptr;
};

#endif
