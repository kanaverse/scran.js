#ifndef NUMERIC_MATRIX_H
#define NUMERIC_MATRIX_H

#include <memory>
#include <cstdint>
#include "tatami/tatami.hpp"
#include "utils.h"

typedef double MatrixValue;
typedef std::int32_t MatrixIndex;

class NumericMatrix {
public:
    NumericMatrix() = default;

    NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p);

public:
    MatrixIndex nrow() const;

    MatrixIndex ncol() const;

    JsFakeInt nrow_js() const;

    JsFakeInt ncol_js() const;

public:
    bool sparse() const;

    NumericMatrix clone() const;

    // Not thread-safe! by_row and by_column are initialized
    // on demand when particular rows and columns are requested
    // in Javascript. Don't use these functions from C++.
    void row(JsFakeInt r, std::uintptr_t values);

    void column(JsFakeInt c, std::uintptr_t values);

public:
    const std::shared_ptr<const tatami::Matrix<MatrixValue, MatrixIndex> >& ptr() const;

    std::shared_ptr<const tatami::Matrix<MatrixValue, MatrixIndex> >& ptr();

    const tatami::Matrix<MatrixValue, MatrixIndex>& operator*() const;

    void reset_ptr(std::shared_ptr<const tatami::Matrix<MatrixValue, MatrixIndex> >);

private:
    std::shared_ptr<const tatami::Matrix<MatrixValue, MatrixIndex> > my_ptr;

    std::unique_ptr<tatami::MyopicDenseExtractor<MatrixValue, MatrixIndex> > my_by_row, my_by_column;
};

#endif
