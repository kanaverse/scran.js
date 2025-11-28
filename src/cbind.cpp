#include <emscripten/bind.h>

#include <cstdint>
#include <vector>
#include <stdexcept>

#include "NumericMatrix.h"
#include "utils.h"

#include "tatami/tatami.hpp"

NumericMatrix js_cbind(JsFakeInt n_raw, JsFakeInt mats_raw) {
    const auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n_raw, mats_raw);
    const auto n = mat_ptrs.size();
    if (n == 0) {
        throw std::runtime_error("need at least one matrix to cbind");
    }

    std::vector<std::shared_ptr<const tatami::Matrix<double, std::int32_t> > > collected;
    collected.reserve(mat_ptrs.size());

    const auto& first = mat_ptrs.front()->ptr();
    const auto NR = first->nrow();
    collected.push_back(first);

    for (I<decltype(n)> i = 1; i < n; ++i) {
        const auto& current = mat_ptrs[i]->ptr();
        if (current->nrow() != NR) {
            throw "all matrices to cbind should have the same number of rows";
        }
        collected.push_back(current);
    }

    return NumericMatrix(
        std::make_shared<tatami::DelayedBind<double, std::int32_t> >(std::move(collected), false)
    );
}

NumericMatrix js_rbind(JsFakeInt n_raw, JsFakeInt mats_raw) {
    const auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n_raw, mats_raw);
    const auto n = mat_ptrs.size();
    if (n == 0) {
        throw std::runtime_error("need at least one matrix to rbind");
    }

    std::vector<std::shared_ptr<const tatami::Matrix<double, std::int32_t> > > collected;
    collected.reserve(mat_ptrs.size());

    const auto& first = mat_ptrs.front()->ptr();
    const auto NC = first->ncol();
    collected.push_back(first);

    for (I<decltype(n)> i = 1; i < n; ++i) {
        const auto& current = mat_ptrs[i]->ptr();
        if (current->ncol() != NC) {
            throw "all matrices to rbind should have the same number of columns";
        }
        collected.push_back(current);
    }

    return NumericMatrix(
        std::make_shared<tatami::DelayedBind<double, std::int32_t> >(std::move(collected), true)
    );
}

EMSCRIPTEN_BINDINGS(cbind) {
    emscripten::function("cbind", &js_cbind, emscripten::return_value_policy::take_ownership());

    emscripten::function("rbind", &js_rbind, emscripten::return_value_policy::take_ownership());
}
