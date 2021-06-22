#include <emscripten/bind.h>
#include "tatami/base/DenseMatrix.hpp"

template<typename T>
class JSVector {
public:
    JSVector(const T* p, size_t n) : ptr(p), num(n) {}
    size_t size() const { return num; }
    const T* data() const { return ptr; }
    const T* begin() const { return ptr; }
    const T* end() const { return ptr + num; }
private:
    const T* ptr;
    size_t num;
};

class NumericMatrix {
public:
    NumericMatrix(int nr, int nc, uintptr_t values) {
        JSVector<double> thing(reinterpret_cast<const double*>(values), nr*nc);
        ptr = std::shared_ptr<tatami::numeric_matrix>(new tatami::DenseRowMatrix<double, int, decltype(thing)>(nr, nc, thing));
        return;
    }

    int nrow() const {
        return ptr->nrow();
    }

    int ncol() const {
        return ptr->ncol();
    }

    void row(int r, uintptr_t values) {
        double* buffer = reinterpret_cast<double*>(values);
        auto out = ptr->row(r, buffer);
        if (out != buffer) {
            std::copy(out, out + ptr->ncol(), buffer);
        }
        return;
    }

    void column(int c, uintptr_t values) {
        double* buffer = reinterpret_cast<double*>(values);
        auto out = ptr->column(c, buffer);
        if (out != buffer) {
            std::copy(out, out + ptr->nrow(), buffer);
        }
        return;
    }

private:
    std::shared_ptr<tatami::numeric_matrix> ptr;
};

EMSCRIPTEN_BINDINGS(my_class_example) {
    emscripten::class_<NumericMatrix>("NumericMatrix")
        .constructor<int, int, uintptr_t>()
        .function("nrow", &NumericMatrix::nrow)
        .function("ncol", &NumericMatrix::ncol)
        .function("row", &NumericMatrix::row)
        .function("column", &NumericMatrix::column)
        ;
}
