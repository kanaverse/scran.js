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
    void row(int r, uintptr_t values) const;

    void column(int c, uintptr_t values) const;

    bool sparse() const;

    NumericMatrix clone() const;

public:
    std::shared_ptr<const tatami::NumericMatrix> ptr;

    std::unique_ptr<tatami::FullDenseExtractor<double, int> > by_row, by_column;
};

#endif
