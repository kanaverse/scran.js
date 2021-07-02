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
    /** Construct a `NumericMatrix` from an existing pointer to a `tatami::numeric_matrix`.
     *
     * @param p Pointer to a `tatami::numeric_matrix`.
     */
    NumericMatrix(const tatami::numeric_matrix* p);

    /** Construct a `NumericMatrix` from an existing pointer to a `tatami::numeric_matrix`.
     *
     * @param p Pointer to a `tatami::numeric_matrix`.
     */
    NumericMatrix(std::shared_ptr<const tatami::numeric_matrix> p);

    /**
     * Construct a `NumericMatrix` from a row-major dense array.
     *
     * @param nr Number of rows.
     * @param nc Number of columns.
     * @param values Offset to the start of an input array of `double`s of length `nr*nc`.
     */
    NumericMatrix(int nr, int nc, uintptr_t values);

    /** 
     * @return Number of rows in the matrix.
     */
    int nrow() const;

    /** 
     * @return Number of columns in the matrix.
     */
    int ncol() const;

    /** 
     * @param r Requested row.
     * @param values Offset to the start of an output array of `double`s of length equal to `ncol()`.
     *
     * @return The array in `values` is filled with the values of row `r`.
     */
    void row(int r, uintptr_t values);

    /** 
     * @param c Requested column.
     * @param values Offset to the start of an output array of `double`s of length equal to `nrow()`.
     *
     * @return The array in `values` is filled with the values of column `c`.
     */
    void column(int c, uintptr_t values);

    /** 
     * A pointer to a `tatami::numeric_matrix`, for use in other functions.
     */
    std::shared_ptr<const tatami::numeric_matrix> ptr;
};

#endif
