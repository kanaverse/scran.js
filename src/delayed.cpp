#include <emscripten/bind.h>

#include <vector>

#include "NumericMatrix.h"
#include "utils.h"

#include "tatami/tatami.hpp"

void delayed_arithmetic_scalar(NumericMatrix& x, std::string op, bool right, double val) {
    if (op == "+") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricAddScalar(val)));
    } else if (op == "*") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricMultiplyScalar(val)));
    } else if (op == "-") {
        if (right) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricSubtractScalar<true>(val)));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricSubtractScalar<false>(val)));
        }
    } else if (op == "/") {
        if (right) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricDivideScalar<true>(val)));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricDivideScalar<false>(val)));
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
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricAddVector(std::move(store), margin == 0)));
    } else if (op == "*") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricMultiplyVector(std::move(store), margin == 0)));
    } else if (op == "-") {
        if (right) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricSubtractVector<true>(std::move(store), margin == 0)));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricSubtractVector<false>(std::move(store), margin == 0)));
        }
    } else if (op == "/") {
        if (right) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricDivideVector<true>(std::move(store), margin == 0)));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::make_DelayedUnaryIsometricDivideVector<false>(std::move(store), margin == 0)));
        }
    } else {
        throw std::runtime_error("unknown arithmetic operation '" + op + "'");
    }
}

void delayed_math(NumericMatrix& x, std::string op, double base) {
    if (op == "abs") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::DelayedUnaryIsometricAbs()));
    } else if (op == "sqrt") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::DelayedUnaryIsometricSqrt()));
    } else if (op == "log1p") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::DelayedUnaryIsometricLog1p()));
    } else if (op == "exp") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::DelayedUnaryIsometricExp()));
    } else if (op == "round") {
        x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::DelayedUnaryIsometricRound()));
    } else if (op == "log") {
        if (base > 0) {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::DelayedUnaryIsometricLog(base)));
        } else {
            x.reset_ptr(tatami::make_DelayedUnaryIsometricOperation(std::move(x.ptr), tatami::DelayedUnaryIsometricLog()));
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
