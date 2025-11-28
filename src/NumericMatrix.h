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

    NumericMatrix(std::shared_ptr<const tatami::NumericMatrix> p) : my_ptr(std::move(p)) {}

public:
    const std::shared_ptr<const tatami::Matrix<MatrixValue, MatrixIndex> >& ptr() const {
        return my_ptr;
    }

    void reset_ptr(std::shared_ptr<const tatami::NumericMatrix> p) {
        my_ptr = std::move(p);
        my_by_row.reset();
        my_by_column.reset();
    }

public:
    JsFakeInt js_nrow() const {
        return int2js(my_ptr->nrow());
    }

    JsFakeInt js_ncol() const {
        return int2js(my_ptr->ncol());
    }

    bool js_sparse() const {
        return my_ptr->sparse(); 
    }

public:
    // Not thread-safe! by_row and by_column are initialized
    // on demand when particular rows and columns are requested
    // in Javascript. Don't use these functions from C++.
    void js_row(JsFakeInt r_raw, JsFakeInt values_raw) {
        const auto values = js2int<std::uintptr_t>(values_raw);
        MatrixValue* buffer = reinterpret_cast<MatrixValue*>(values);
        if (!my_by_row) {
            my_by_row = my_ptr->dense_row();
        }
        auto out = my_by_row->fetch(js2int<MatrixIndex>(r_raw), buffer);
        tatami::copy_n(out, my_ptr->ncol(), buffer);
        return;
    }

    void js_column(JsFakeInt c_raw, JsFakeInt values_raw) {
        const auto values = js2int<std::uintptr_t>(values_raw);
        MatrixValue* buffer = reinterpret_cast<MatrixValue*>(values);
        if (!my_by_column) {
            my_by_column = my_ptr->dense_column();
        }
        auto out = my_by_column->fetch(js2int<MatrixIndex>(c_raw), buffer);
        tatami::copy_n(out, my_ptr->nrow(), buffer);
        return;
    }

public:
    NumericMatrix js_clone() const {
        return NumericMatrix(my_ptr);
    }

private:
    std::shared_ptr<const tatami::Matrix<MatrixValue, MatrixIndex> > my_ptr;

    std::unique_ptr<tatami::MyopicDenseExtractor<MatrixValue, MatrixIndex> > my_by_row, my_by_column;
};

#endif
