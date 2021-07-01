#ifndef NUMERIC_MATRIX_H
#define NUMERIC_MATRIX_H

#include "JSVector.h"
#include "tatami/tatami.h"

/**
 * @brief A numeric matrix that stores conceptual `double`s.
 *
 * This provides a wrapper around a `tatami::numeric_matrix` with Javascript-visible bindings to some basic methods.
 */
struct NumericMatrix {
    /**
     * Construct a `NumericMatrix` from a row-major dense array.
     *
     * @param nr Number of rows.
     * @param nc Number of columns.
     * @param values Offset to the start of an input array of `double`s of length `nr*nc`.
     */
    NumericMatrix(int nr, int nc, uintptr_t values) {
        JSVector<double> thing(reinterpret_cast<const double*>(values), nr*nc);
        ptr = std::shared_ptr<tatami::numeric_matrix>(new tatami::DenseRowMatrix<double, int, decltype(thing)>(nr, nc, thing));
        return;
    }

    /** 
     * @return Number of rows in the matrix.
     */
    int nrow() const {
        return ptr->nrow();
    }

    /** 
     * @return Number of columns in the matrix.
     */
    int ncol() const {
        return ptr->ncol();
    }

    /** 
     * @param r Requested row.
     * @param values Offset to the start of an output array of `double`s of length equal to `ncol()`.
     *
     * @return The array in `values` is filled with the values of row `r`.
     */
    void row(int r, uintptr_t values) {
        double* buffer = reinterpret_cast<double*>(values);
        auto out = ptr->row(r, buffer);
        if (out != buffer) {
            std::copy(out, out + ptr->ncol(), buffer);
        }
        return;
    }

    /** 
     * @param c Requested column.
     * @param values Offset to the start of an output array of `double`s of length equal to `nrow()`.
     *
     * @return The array in `values` is filled with the values of column `c`.
     */
    void column(int c, uintptr_t values) {
        double* buffer = reinterpret_cast<double*>(values);
        auto out = ptr->column(c, buffer);
        if (out != buffer) {
            std::copy(out, out + ptr->nrow(), buffer);
        }
        return;
    }

    /** 
     * A pointer to a `tatami::numeric_matrix`, for use in other functions.
     */
    std::shared_ptr<tatami::numeric_matrix> ptr;
};

#endif
