#ifndef NUMERIC_MATRIX_H
#define NUMERIC_MATRIX_H

#include "parallel.h"

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
    NumericMatrix();

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
     * @param i Vector of length equal to the number of rows of `p`,
     * containing the identity of each row (typically as indices of the original dataset).
     */
    NumericMatrix(const tatami::NumericMatrix* p, std::vector<size_t> i);

    /** Construct a `NumericMatrix` from an existing pointer to a `tatami::NumericMatrix`.
     *
     * @param p Pointer to a `tatami::NumericMatrix`.
     * @param i Vector of length equal to the number of rows of `p`, 
     * containing the identity of each row (typically as indices of the original dataset).
     */
    NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p, std::vector<size_t> i);

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
     * @return The array in `values` is filled with the row identities.
     *
     * This function should only be called if `reorganized()` returns `true`.
     */
    void identities(uintptr_t values) const;

    /**
     * @return Whether the underlying matrix contains a non-trivial row reorganization.
     * If `false`, the row identities are assumed to be trivial (containing consecutive increasing values from 0) and so is not explicitly stored in `identities()`.
     */
    bool reorganized() const;

    void wipe_identities();

    /**
     * @return Whether the underlying matrix is sparse.
     */
    bool sparse() const;

    NumericMatrix clone() const;

    /** 
     * @cond
     */
    std::shared_ptr<const tatami::NumericMatrix> ptr;

    std::vector<size_t> row_ids;

    bool is_reorganized;
    /**
     * @endcond
     */
};

#endif
