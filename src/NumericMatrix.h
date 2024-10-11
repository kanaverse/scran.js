#ifndef NUMERIC_MATRIX_H
#define NUMERIC_MATRIX_H

#include <memory>
#include <cstdint>
#include "tatami/tatami.hpp"

struct NumericMatrix {
    NumericMatrix();

    NumericMatrix(const tatami::NumericMatrix* p);

    NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p);

    NumericMatrix(int32_t nr, int32_t nc, uintptr_t values, bool, bool);

public:
    int32_t nrow() const;

    int32_t ncol() const;

public:
    bool sparse() const;

    NumericMatrix clone() const;

    // Not thread-safe! by_row and by_column are initialized
    // on demand when particular rows and columns are requested
    // in Javascript. Don't use these functions from C++.
    void row(int32_t r, uintptr_t values);

    void column(int32_t c, uintptr_t values);

public:
    std::shared_ptr<const tatami::Matrix<double, int32_t> > ptr;

    std::unique_ptr<tatami::MyopicDenseExtractor<double, int32_t> > by_row, by_column;

    void reset_ptr(std::shared_ptr<const tatami::Matrix<double, int32_t> >);
};

#endif
