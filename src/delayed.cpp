#include <emscripten/bind.h>

#include <vector>
#include <string>
#include <cstdint>
#include <cstddef>
#include <stdexcept>

#include "NumericMatrix.h"
#include "utils.h"

#include "tatami/tatami.hpp"
#include "sanisizer/sanisizer.hpp"

void js_delayed_arithmetic_scalar(NumericMatrix& x, std::string op, bool right, double val) {
    std::shared_ptr<tatami::DelayedUnaryIsometricOperationHelper<double, double, std::int32_t> > operation;

    if (op == "+") {
        operation.reset(new tatami::DelayedUnaryIsometricAddScalarHelper<double, double, std::int32_t, double>(val));
    } else if (op == "*") {
        operation.reset(new tatami::DelayedUnaryIsometricMultiplyScalarHelper<double, double, std::int32_t, double>(val));
    } else if (op == "-") {
        if (right) {
            operation.reset(new tatami::DelayedUnaryIsometricSubtractScalarHelper<true, double, double, std::int32_t, double>(val));
        } else {
            operation.reset(new tatami::DelayedUnaryIsometricSubtractScalarHelper<false, double, double, std::int32_t, double>(val));
        }
    } else if (op == "/") {
        if (right) {
            operation.reset(new tatami::DelayedUnaryIsometricDivideScalarHelper<true, double, double, std::int32_t, double>(val));
        } else {
            operation.reset(new tatami::DelayedUnaryIsometricDivideScalarHelper<false, double, double, std::int32_t, double>(val));
        }
    } else {
        throw std::runtime_error("unknown arithmetic operation '" + op + "'");
    }

    x.reset_ptr(std::make_shared<tatami::DelayedUnaryIsometricOperation<double, double, std::int32_t> >(std::move(x.ptr()), std::move(operation)));
}

void js_delayed_arithmetic_vector(NumericMatrix& x, std::string op, bool right, JsFakeInt margin_raw, JsFakeInt ptr_raw, JsFakeInt n_raw) {
    const auto margin = js2int<int>(margin_raw);
    const auto n = js2int<std::size_t>(n_raw);
    if (!sanisizer::is_equal(n, margin == 0 ? x.nrow() : x.ncol())) {
        throw std::runtime_error("inappropriate length of vector for delayed arithmetic");
    }

    const auto ptr = js2int<std::uintptr_t>(ptr_raw);
    auto input = reinterpret_cast<const double*>(ptr);
    std::vector<double> store(input, input + n);

    std::shared_ptr<tatami::DelayedUnaryIsometricOperationHelper<double, double, std::int32_t> > operation;

    if (op == "+") {
        operation.reset(new tatami::DelayedUnaryIsometricAddVectorHelper<double, double, std::int32_t, I<decltype(store)> >(std::move(store), margin == 0));
    } else if (op == "*") {
        operation.reset(new tatami::DelayedUnaryIsometricMultiplyVectorHelper<double, double, std::int32_t, I<decltype(store)> >(std::move(store), margin == 0));
    } else if (op == "-") {
        if (right) {
            operation.reset(new tatami::DelayedUnaryIsometricSubtractVectorHelper<true, double, double, std::int32_t, I<decltype(store)> >(std::move(store), margin == 0));
        } else {
            operation.reset(new tatami::DelayedUnaryIsometricSubtractVectorHelper<false, double, double, std::int32_t, I<decltype(store)> >(std::move(store), margin == 0));
        }
    } else if (op == "/") {
        if (right) {
            operation.reset(new tatami::DelayedUnaryIsometricDivideVectorHelper<true, double, double, std::int32_t, I<decltype(store)> >(std::move(store), margin == 0));
        } else {
            operation.reset(new tatami::DelayedUnaryIsometricDivideVectorHelper<false, double, double, std::int32_t, I<decltype(store)> >(std::move(store), margin == 0));
        }
    } else {
        throw std::runtime_error("unknown arithmetic operation '" + op + "'");
    }

    x.reset_ptr(std::make_shared<tatami::DelayedUnaryIsometricOperation<double, double, std::int32_t> >(std::move(x.ptr()), std::move(operation)));
}

void js_delayed_math(NumericMatrix& x, std::string op, double base) {
    std::shared_ptr<tatami::DelayedUnaryIsometricOperationHelper<double, double, std::int32_t> > operation;

    if (op == "abs") {
        operation.reset(new tatami::DelayedUnaryIsometricAbsHelper<double, double, std::int32_t>());
    } else if (op == "sqrt") {
        operation.reset(new tatami::DelayedUnaryIsometricSqrtHelper<double, double, std::int32_t>());
    } else if (op == "log1p") {
        operation.reset(new tatami::DelayedUnaryIsometricLog1pHelper<double, double, std::int32_t, double>());
    } else if (op == "exp") {
        operation.reset(new tatami::DelayedUnaryIsometricExpHelper<double, double, std::int32_t>());
    } else if (op == "round") {
        operation.reset(new tatami::DelayedUnaryIsometricRoundHelper<double, double, std::int32_t>());
    } else if (op == "log") {
        if (base > 0) {
            operation.reset(new tatami::DelayedUnaryIsometricLogHelper<double, double, std::int32_t, double>(base));
        } else {
            operation.reset(new tatami::DelayedUnaryIsometricLogHelper<double, double, std::int32_t, double>());
        }
    } else {
        throw std::runtime_error("unknown math operation '" + op + "'");
    }

    x.reset_ptr(std::make_shared<tatami::DelayedUnaryIsometricOperation<double, double, std::int32_t> >(std::move(x.ptr()), std::move(operation)));
}

void js_transpose(NumericMatrix& x) {
    x.reset_ptr(std::make_shared<tatami::DelayedTranspose<double, std::int32_t> >(std::move(x.ptr())));
    return;
}

EMSCRIPTEN_BINDINGS(delayed_operations) {
    emscripten::function("delayed_arithmetic_scalar", &js_delayed_arithmetic_scalar, emscripten::return_value_policy::take_ownership());
    emscripten::function("delayed_arithmetic_vector", &js_delayed_arithmetic_vector, emscripten::return_value_policy::take_ownership());
    emscripten::function("delayed_math", &js_delayed_math, emscripten::return_value_policy::take_ownership());
    emscripten::function("transpose", &js_transpose, emscripten::return_value_policy::take_ownership());
}
