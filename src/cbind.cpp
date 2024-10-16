#include <emscripten/bind.h>

#include <cstdint>
#include <vector>
#include <stdexcept>

#include "NumericMatrix.h"
#include "utils.h"

#include "tatami/tatami.hpp"

NumericMatrix cbind(int32_t n, uintptr_t mats) {
    if (n == 0) {
        throw std::runtime_error("need at least one matrix to cbind");
    }

    auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n, mats);
    std::vector<std::shared_ptr<const tatami::Matrix<double, int32_t> > > collected;
    collected.reserve(mat_ptrs.size());

    const auto& first = *(mat_ptrs.front());
    size_t NR = first.ptr->nrow();
    collected.push_back(first.ptr);

    for (int32_t i = 1; i < n; ++i) {
        const auto& current = *(mat_ptrs[i]);
        if (current.ptr->nrow() != NR) {
            throw "all matrices to cbind should have the same number of rows";
        }
        collected.push_back(current.ptr);
    }

    return NumericMatrix(tatami::make_DelayedBind<1>(std::move(collected)));
}

NumericMatrix rbind(int32_t n, uintptr_t mats) {
    if (n == 0) {
        throw std::runtime_error("need at least one matrix to cbind");
    }

    auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n, mats);
    std::vector<std::shared_ptr<const tatami::Matrix<double, int32_t> > > collected;
    collected.reserve(mat_ptrs.size());

    const auto& first = *(mat_ptrs.front());
    size_t NC = first.ptr->ncol();
    collected.push_back(first.ptr);

    for (int32_t i = 1; i < n; ++i) {
        const auto& current = *(mat_ptrs[i]);
        if (current.ptr->ncol() != NC) {
            throw "all matrices to rbind should have the same number of columns";
        }
        collected.push_back(current.ptr);
    }

    return NumericMatrix(tatami::make_DelayedBind<0>(std::move(collected)));
}

EMSCRIPTEN_BINDINGS(cbind) {
    emscripten::function("cbind", &cbind, emscripten::return_value_policy::take_ownership());

    emscripten::function("rbind", &rbind, emscripten::return_value_policy::take_ownership());
}
