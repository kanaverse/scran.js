#include <emscripten/bind.h>

#include <vector>

#include "parallel.h"
#include "NumericMatrix.h"
#include "utils.h"

#include "tatami/tatami.hpp"

void delayed_arithmetic_scalar(NumericMatrix& x, std::string op, bool right, double val) {
    if (op == "+") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedAddScalarHelper(val)));
    } else if (op == "*") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedMultiplyScalarHelper(val)));
    } else if (op == "-") {
        if (right) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractScalarHelper<true>(val)));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractScalarHelper<false>(val)));
        }
    } else if (op == "/") {
        if (right) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideScalarHelper<true>(val)));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideScalarHelper<false>(val)));
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
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedAddVectorHelper<1>(std::move(store))));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedAddVectorHelper<0>(std::move(store))));
        }
    } else if (op == "*") {
        if (margin == 1) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedMultiplyVectorHelper<1>(std::move(store))));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedMultiplyVectorHelper<0>(std::move(store))));
        }
    } else if (op == "-") {
        if (right) {
            if (margin == 1) {
                x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<true, 1>(std::move(store))));
            } else {
                x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<true, 0>(std::move(store))));
            }
        } else {
            if (margin == 1) {
                x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<false, 1>(std::move(store))));
            } else {
                x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<false, 0>(std::move(store))));
            }
        }
    } else if (op == "/") {
        if (right) {
            if (margin == 1) {
                x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<true, 1>(std::move(store))));
            } else {
                x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<true, 0>(std::move(store))));
            }
        } else {
            if (margin == 1) {
                x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<false, 1>(std::move(store))));
            } else {
                x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<false, 0>(std::move(store))));
            }
        }
    } else {
        throw std::runtime_error("unknown arithmetic operation '" + op + "'");
    }
}

void delayed_math(NumericMatrix& x, std::string op, double base) {
    if (op == "abs") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedAbsHelper()));
    } else if (op == "sqrt") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedSqrtHelper()));
    } else if (op == "log1p") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedLog1pHelper()));
    } else if (op == "exp") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedExpHelper()));
    } else if (op == "round") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedRoundHelper()));
    } else if (op == "log") {
        if (base > 0) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedLogHelper(base)));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOp(std::move(x.ptr), tatami::DelayedLogHelper()));
        }
    } else {
        throw std::runtime_error("unknown math operation '" + op + "'");
    }
}

void transpose(NumericMatrix& x) {
    x.reset_ptr(tatami::make_DelayedTranspose(std::move(x.ptr)));
    return;
}

EMSCRIPTEN_BINDINGS(delayed_operations) {
    emscripten::function("delayed_arithmetic_scalar", &delayed_arithmetic_scalar, emscripten::return_value_policy::take_ownership());
    emscripten::function("delayed_arithmetic_vector", &delayed_arithmetic_vector, emscripten::return_value_policy::take_ownership());
    emscripten::function("delayed_math", &delayed_math, emscripten::return_value_policy::take_ownership());
    emscripten::function("transpose", &transpose, emscripten::return_value_policy::take_ownership());
}
