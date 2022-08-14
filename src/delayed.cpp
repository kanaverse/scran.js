#include <emscripten/bind.h>

#include <vector>

#include "parallel.h"
#include "NumericMatrix.h"
#include "utils.h"

#include "tatami/tatami.hpp"

/******* scalar arithmetic ******/

void delayed_add_scalar(NumericMatrix& x, double val) {
    auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedAddScalarHelper(val));
    x.ptr = alt;
}

void delayed_multiply_scalar(NumericMatrix& x, double val) {
    auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedMultiplyScalarHelper(val));
    x.ptr = alt;
}

void delayed_subtract_scalar(NumericMatrix& x, double val, bool right) {
    if (right) {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedSubtractScalarHelper<true>(val));
        x.ptr = alt;
    } else {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedSubtractScalarHelper<false>(val));
        x.ptr = alt;
    }
}

void delayed_divide_scalar(NumericMatrix& x, double val, bool right) {
    if (right) {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedDivideScalarHelper<true>(val));
        x.ptr = alt;
    } else {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedDivideScalarHelper<false>(val));
        x.ptr = alt;
    }
}

/******* vector arithmetic ******/

std::vector<double> vectorize_store(const NumericMatrix& x, uintptr_t ptr, size_t n, int margin, bool already_permuted) {
    if (n != static_cast<size_t>(margin == 0 ? x.nrow() : x.ncol())) {
        throw std::runtime_error("inappropriate length of vector for delayed arithmetic");
    }

    auto input = reinterpret_cast<const double*>(ptr);
    std::vector<double> store(n);

    if (margin == 0 && !already_permuted && x.is_reorganized) {
        const auto& ids = x.row_ids;
        for (size_t r = 0; r < n; ++r) {
            store[r] = input[ids[r]];
        }
    } else {
        std::copy(input, input + n, store.begin());
    }

    return store;
}

void delayed_add_vector(NumericMatrix& x, uintptr_t ptr, size_t n, int margin, bool already_permuted) {
    auto store = vectorize_store(x, ptr, n, margin, already_permuted);
    if (margin == 1) {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedAddVectorHelper<1>(std::move(store)));
        x.ptr = alt;
    } else {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedAddVectorHelper<0>(std::move(store)));
        x.ptr = alt;
    }
}

void delayed_multiply_vector(NumericMatrix& x, uintptr_t ptr, size_t n, int margin, bool already_permuted) {
    auto store = vectorize_store(x, ptr, n, margin, already_permuted);
    if (margin == 1) {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedMultiplyVectorHelper<1>(std::move(store)));
        x.ptr = alt;
    } else {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedMultiplyVectorHelper<0>(std::move(store)));
        x.ptr = alt;
    }
}

void delayed_subtract_vector(NumericMatrix& x, uintptr_t ptr, size_t n, int margin, bool right, bool already_permuted) {
    auto store = vectorize_store(x, ptr, n, margin, already_permuted);
    if (right) {
        if (margin == 1) {
            auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<true, 1>(std::move(store)));
            x.ptr = alt;
        } else {
            auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<true, 0>(std::move(store)));
            x.ptr = alt;
        }
    } else {
        if (margin == 1) {
            auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<false, 1>(std::move(store)));
            x.ptr = alt;
        } else {
            auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedSubtractVectorHelper<false, 0>(std::move(store)));
            x.ptr = alt;
        }
    }
}

void delayed_divide_vector(NumericMatrix& x, uintptr_t ptr, size_t n, int margin, bool right, bool already_permuted) {
    auto store = vectorize_store(x, ptr, n, margin, already_permuted);
    if (right) {
        if (margin == 1) {
            auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<true, 1>(std::move(store)));
            x.ptr = alt;
        } else {
            auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<true, 0>(std::move(store)));
            x.ptr = alt;
        }
    } else {
        if (margin == 1) {
            auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<false, 1>(std::move(store)));
            x.ptr = alt;
        } else {
            auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::make_DelayedDivideVectorHelper<false, 0>(std::move(store)));
            x.ptr = alt;
        }
    }
}

/******* math ******/

void delayed_log(NumericMatrix& x, double base) {
    if (base > 0) {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedLogHelper(base));
        x.ptr = alt;
    } else {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedLogHelper());
        x.ptr = alt;
    }
}

void delayed_math(NumericMatrix& x, std::string op) {
    if (op == "abs") {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedAbsHelper());
        x.ptr = alt;
    } else if (op == "sqrt") {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedSqrtHelper());
        x.ptr = alt;
    } else if (op == "log1p") {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedLog1pHelper());
        x.ptr = alt;
    } else if (op == "exp") {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedExpHelper());
        x.ptr = alt;
    } else if (op == "round") {
        auto alt = tatami::make_DelayedIsometricOp(std::move(x.ptr), tatami::DelayedRoundHelper());
        x.ptr = alt;
    } else {
        throw std::runtime_error("unknown operation '" + op + "'");
    }
}

/******* bindings ******/

EMSCRIPTEN_BINDINGS(delayed_operations) {
    emscripten::function("delayed_add_scalar", &delayed_add_scalar);
    emscripten::function("delayed_multiply_scalar", &delayed_multiply_scalar);
    emscripten::function("delayed_subtract_scalar", &delayed_subtract_scalar);
    emscripten::function("delayed_divide_scalar", &delayed_divide_scalar);

    emscripten::function("delayed_add_vector", &delayed_add_vector);
    emscripten::function("delayed_multiply_vector", &delayed_multiply_vector);
    emscripten::function("delayed_subtract_vector", &delayed_subtract_vector);
    emscripten::function("delayed_divide_vector", &delayed_divide_vector);

    emscripten::function("delayed_log", &delayed_log);
    emscripten::function("delayed_math", &delayed_math);
}
