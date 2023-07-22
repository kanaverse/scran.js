#ifndef NUMERIC_MATRIX_H
#define NUMERIC_MATRIX_H

#include "parallel.h"

#include "tatami/tatami.hpp"

struct NumericMatrix {
    NumericMatrix();

    NumericMatrix(const tatami::NumericMatrix* p);

    NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p);

    NumericMatrix(int nr, int nc, uintptr_t values, bool, bool);

public:
    int nrow() const;

    int ncol() const;

public:
    bool sparse() const;

    NumericMatrix clone() const;

    // Not thread-safe! by_row and by_column are initialized
    // on demand when particular rows and columns are requested
    // in Javascript. Don't use these functions from C++.
    void row(int r, uintptr_t values);

    void column(int c, uintptr_t values);

public:
    std::shared_ptr<const tatami::NumericMatrix> ptr;

    std::unique_ptr<tatami::FullDenseExtractor<double, int> > by_row, by_column;

    void reset_ptr(std::shared_ptr<const tatami::NumericMatrix>);
};

#endif
