#include <emscripten/bind.h>

#include <vector>

#include "parallel.h"
#include "NumericMatrix.h"
#include "utils.h"

#include "tatami/tatami.hpp"

void delayed_arithmetic_scalar(NumericMatrix& x, std::string op, bool right, double val) {
    if (op == "+") {
        auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedAddScalarHelper(val));
        x.ptr = std::move(alt);
    } else if (op == "*") {
        auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedMultiplyScalarHelper(val));
        x.ptr = std::move(alt);
    } else if (op == "-") {
        if (right) {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractScalarHelper<true>(val));
            x.ptr = std::move(alt);
        } else {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractScalarHelper<false>(val));
            x.ptr = std::move(alt);
        }
    } else if (op == "/") {
        if (right) {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideScalarHelper<true>(val));
            x.ptr = std::move(alt);
        } else {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideScalarHelper<false>(val));
            x.ptr = std::move(alt);
        }
    } else {
        throw std::runtime_error("unknown arithmetic operation '" + op + "'");
    }
}

void delayed_arithmetic_vector(NumericMatrix& x, std::string op, bool right, int margin, uintptr_t ptr, size_t n) {
    if (n != static_cast<size_t>(margin == 0 ? x.nrow() : x.ncol())) {
        throw std::runtime_error("inappropriate length of vector for delayed arithmetic");
    }
    auto input = reinterpret_cast<const double*>(ptr);
    std::vector<double> store(input, input + n);

    if (op == "+") {
        if (margin == 1) {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedAddVectorHelper<1>(std::move(store)));
            x.ptr = std::move(alt);
        } else {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedAddVectorHelper<0>(std::move(store)));
            x.ptr = std::move(alt);
        }
    } else if (op == "*") {
        if (margin == 1) {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedMultiplyVectorHelper<1>(std::move(store)));
            x.ptr = std::move(alt);
        } else {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedMultiplyVectorHelper<0>(std::move(store)));
            x.ptr = std::move(alt);
        }
    } else if (op == "-") {
        if (right) {
            if (margin == 1) {
                auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<true, 1>(std::move(store)));
                x.ptr = std::move(alt);
            } else {
                auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<true, 0>(std::move(store)));
                x.ptr = std::move(alt);
            }
        } else {
            if (margin == 1) {
                auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<false, 1>(std::move(store)));
                x.ptr = std::move(alt);
            } else {
                auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<false, 0>(std::move(store)));
                x.ptr = std::move(alt);
            }
        }
    } else if (op == "/") {
        if (right) {
            if (margin == 1) {
                auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<true, 1>(std::move(store)));
                x.ptr = std::move(alt);
            } else {
                auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<true, 0>(std::move(store)));
                x.ptr = std::move(alt);
            }
        } else {
            if (margin == 1) {
                auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<false, 1>(std::move(store)));
                x.ptr = std::move(alt);
            } else {
                auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<false, 0>(std::move(store)));
                x.ptr = std::move(alt);
            }
        }
    } else {
        throw std::runtime_error("unknown arithmetic operation '" + op + "'");
    }
}

void delayed_math(NumericMatrix& x, std::string op, double base) {
    if (op == "abs") {
        auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedAbsHelper());
        x.ptr = std::move(alt);
    } else if (op == "sqrt") {
        auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedSqrtHelper());
        x.ptr = std::move(alt);
    } else if (op == "log1p") {
        auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedLog1pHelper());
        x.ptr = std::move(alt);
    } else if (op == "exp") {
        auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedExpHelper());
        x.ptr = std::move(alt);
    } else if (op == "round") {
        auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedRoundHelper());
        x.ptr = std::move(alt);
    } else if (op == "log") {
        if (base > 0) {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedLogHelper(base));
            x.ptr = std::move(alt);
        } else {
            auto alt = tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedLogHelper());
            x.ptr = std::move(alt);
        }
    } else {
        throw std::runtime_error("unknown math operation '" + op + "'");
    }
}

void transpose(NumericMatrix& x) {
    auto alt = tatami::make_DelayedTranspose(std::move(x.ptr));
    x.ptr = std::move(alt);
    return;
}

EMSCRIPTEN_BINDINGS(delayed_operations) {
    emscripten::function("delayed_arithmetic_scalar", &delayed_arithmetic_scalar);
    emscripten::function("delayed_arithmetic_vector", &delayed_arithmetic_vector);
    emscripten::function("delayed_math", &delayed_math);
    emscripten::function("transpose", &transpose);
}
