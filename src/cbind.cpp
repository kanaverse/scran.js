#include <emscripten/bind.h>
#include <cstdint>
#include <vector>
#include <stdexcept>
#include "NumericMatrix.h"
#include "utils.h"
#include "tatami/tatami.hpp"

NumericMatrix cbind(int n, uintptr_t mats) {
    if (n == 0) {
        throw std::runtime_error("need at least one matrix to cbind");
    }

    auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n, mats);
    std::vector<std::shared_ptr<const tatami::Matrix<double, int> > > collected;
    collected.reserve(mat_ptrs.size());

    const auto& first = *(mat_ptrs.front());
    size_t NR = first.ptr->nrow();
    collected.push_back(first.ptr);

    for (int i = 1; i < n; ++i) {
        const auto& current = *(mat_ptrs[i]);
        if (current.ptr->nrow() != NR) {
            throw "all matrices to cbind should have the same number of rows";
        }
    }

    if (first.is_permuted) {
        std::vector<int> reversi;
        const auto& first_perm = first.permutation;

        for (int i = 1; i < n; ++i) {
            const auto& current = *(mat_ptrs[i]);
            if (current.is_permuted) {
                const auto& curperm = current.permutation;
                std::vector<size_t> perm_to_first(NR);
                for (size_t i = 0; i < NR; ++i) {
                    perm_to_first[first_perm[i]] = curperm[i];
                }
                collected.push_back(tatami::make_DelayedSubset<0>(current.ptr, std::move(perm_to_first)));
            } else {
                if (reversi.size()) {
                    reversi.resize(NR);
                    for (size_t i = 0; i < NR; ++i) {
                        reversi[first_perm[i]] = i;
                    }
                }
                collected.push_back(tatami::make_DelayedSubset<0>(current.ptr, reversi));
            }
        }
        return NumericMatrix(tatami::make_DelayedBind<1>(std::move(collected)), first_perm);

    } else {
        for (int i = 1; i < n; ++i) {
            const auto& current = *(mat_ptrs[i]);
            if (current.is_permuted) {
                collected.push_back(tatami::make_DelayedSubset<0>(current.ptr, current.permutation));
            } else {
                collected.push_back(current.ptr);
            }
        }
        return NumericMatrix(tatami::make_DelayedBind<1>(std::move(collected)));
    }
}

//NumericMatrix cbind_with_rownames(int n, uintptr_t mats, uintptr_t names) {
//    if (n == 0) {
//        throw std::runtime_error("need at least one matrix to cbind");
//    }
//
//    auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n, mats);
//    if (!use_rownames) {
//        // Possible chance to combine them easily.
//    }
//}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cbind) {
    emscripten::function("cbind", &cbind);
}
/**
 * @endcond
 */

