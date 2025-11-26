#ifndef NUMERIC_MATRIX_H
#define NUMERIC_MATRIX_H

#include <memory>
#include <cstdint>
#include "tatami/tatami.hpp"

class NumericMatrix {
public:
    NumericMatrix() = default;

    NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p);

public:
    std::int32_t nrow() const;

    std::int32_t ncol() const;

    // Returning doubles so that Javascript can deal with Numbers.
    // Technically not necessary here as int32_t will get converted to a Number by embind,
    // but it's best to be safe just in case we change the Index_ type later.
    double nrow_dbl() const;

    double ncol_dbl() const;

public:
    bool sparse() const;

    NumericMatrix clone() const;

    // Not thread-safe! by_row and by_column are initialized
    // on demand when particular rows and columns are requested
    // in Javascript. Don't use these functions from C++.
    void row(std::int32_t r, std::uintptr_t values);

    void column(std::int32_t c, std::uintptr_t values);

public:
    const std::shared_ptr<const tatami::Matrix<double, std::int32_t> >& ptr() const;

    std::shared_ptr<const tatami::Matrix<double, std::int32_t> >& ptr();

    const tatami::Matrix<double, std::int32_t>& operator*() const;

    void reset_ptr(std::shared_ptr<const tatami::Matrix<double, std::int32_t> >);

private:
    std::shared_ptr<const tatami::Matrix<double, std::int32_t> > my_ptr;

    std::unique_ptr<tatami::MyopicDenseExtractor<double, std::int32_t> > my_by_row, my_by_column;

};

#endif
