#ifndef NUMERIC_MATRIX_H
#define NUMERIC_MATRIX_H

#include "JSVector.h"
#include "parallel.h" // must include this, ensure that all compilation units have a modified apply().
#include "tatami/tatami.h"

/**
 * @file NumericMatrix.h
 *
 * @brief Javascript wrapper for a numeric matrix.
 */ 

/**
 * @brief Javascript-visible interface for a matrix of `double`s.
 */
struct NumericMatrix {
    /** Construct a `NumericMatrix` from an existing pointer to a `tatami::NumericMatrix`.
     *
     * @param p Pointer to a `tatami::NumericMatrix`.
     */
    NumericMatrix(const tatami::NumericMatrix* p);

    /** Construct a `NumericMatrix` from an existing pointer to a `tatami::NumericMatrix`.
     *
     * @param p Pointer to a `tatami::NumericMatrix`.
     */
    NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p);

    /** Construct a `NumericMatrix` from an existing pointer to a `tatami::NumericMatrix`.
     *
     * @param p Pointer to a `tatami::NumericMatrix`.
     * @param perm Vector of length equal to the number of rows of `p`, containing the permutation vector.
     */
    NumericMatrix(const tatami::NumericMatrix* p, std::vector<size_t> perm);

    /** Construct a `NumericMatrix` from an existing pointer to a `tatami::NumericMatrix`.
     *
     * @param p Pointer to a `tatami::NumericMatrix`.
     * @param perm Vector of length equal to the number of rows of `p`, containing the permutation vector.
     */
    NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p, std::vector<size_t> perm);

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
    void row(int r, uintptr_t values) const;

    /** 
     * @param c Requested column.
     * @param values Offset to the start of an output array of `double`s of length equal to `nrow()`.
     *
     * @return The array in `values` is filled with the values of column `c`.
     */
    void column(int c, uintptr_t values) const;

    /** 
     * @param values Offset to the start of an output array of `int`s of length equal to `nrow()`.
     *
     * @return The array in `values` is filled with the permutation vector.
     *
     * This function only makes sense if `permuted()` returns `true`.
     */
    void perm(uintptr_t values) const;

    /**
     * @return Whether the underlying matrix contains a row permutation.
     */
    bool permuted() const;

    /** 
     * @cond
     */
    std::shared_ptr<const tatami::NumericMatrix> ptr;

    std::vector<size_t> permutation;

    bool is_permuted;
    /**
     * @endcond
     */
};

#endif
