#include <emscripten/bind.h>
#include <cstdint>
#include <vector>
#include <stdexcept>
#include <unordered_set>
#include <unordered_map>
#include "NumericMatrix.h"
#include "utils.h"
#include "tatami/tatami.hpp"

NumericMatrix cbind(int n, uintptr_t mats, bool same_perm) {
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
            if (same_perm) {
                collected.push_back(current.ptr);
            } else if (current.is_permuted) {
                const auto& curperm = current.permutation;
                std::vector<size_t> perm_to_first(NR);
                for (size_t i = 0; i < NR; ++i) {
                    perm_to_first[first_perm[i]] = curperm[i];
                }
                collected.push_back(tatami::make_DelayedSubset<0>(current.ptr, std::move(perm_to_first)));
            } else {
                if (reversi.empty()) {
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
            if (same_perm || !current.is_permuted) {
                collected.push_back(current.ptr);
            } else {
                collected.push_back(tatami::make_DelayedSubset<0>(current.ptr, current.permutation));
            }
        }
        return NumericMatrix(tatami::make_DelayedBind<1>(std::move(collected)));
    }
}

NumericMatrix cbind_with_rownames(int n, uintptr_t mats, uintptr_t names) {
    if (n == 0) {
        throw std::runtime_error("need at least one matrix to cbind");
    }

    auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n, mats);
    const auto& first = *(mat_ptrs.front());

    // Harvesting the commons.
    auto name_ptrs = convert_array_of_offsets<const int*>(n, names);
    const int* first_names = name_ptrs[0];
    std::unordered_set<int> in_use(first_names, first_names + first.ptr->nrow());

    for (int i = 1; i < n; ++i) {
        std::vector<int> intersection;
        intersection.reserve(in_use.size());

        const auto& current = *(mat_ptrs[i]);
        size_t current_NR = current.ptr->nrow();
        auto current_names = name_ptrs[i];

        for (size_t j = 0; j < current_NR; ++j) {
            if (in_use.find(current_names[j]) != in_use.end()) {
                intersection.push_back(current_names[j]);            
            }
        }

        in_use = std::unordered_set<int>(intersection.begin(), intersection.end());
    }

    std::unordered_map<int, int> mapping;
    std::vector<int> as_vec(in_use.begin(), in_use.end());
    {
        std::sort(as_vec.begin(), as_vec.end());
        int counter = 0;
        for (auto s : as_vec) {
            mapping[s] = counter;
            ++counter;
        }
    }

    // Applying the mapping. We ignore permutations here, under the assumption
    // that same an appropriate permutation was already applied to the row
    // names to match the reordering of the rows.
    std::vector<std::shared_ptr<const tatami::Matrix<double, int> > > collected;
    collected.reserve(mat_ptrs.size());

    for (int i = 0; i < n; ++i) {
        const auto& current = *(mat_ptrs[i]);
        size_t current_NR = current.ptr->nrow();
        auto current_names = name_ptrs[i];

        std::vector<size_t> reorder(mapping.size());
        for (size_t j = 0; j < current_NR; ++j) {
            auto it = mapping.find(current_names[j]);
            if (it != mapping.end()) {
                reorder[it->second] = j;
            }
        }

        collected.push_back(tatami::make_DelayedSubset<0>(current.ptr, std::move(reorder)));
    }

    // Here, the permutation slot is just being re-used to define the intersection.
    // We set is_permuted = false to indicate as such; we expect the caller to apply 
    // the relevant subsetting of the feature information.
    NumericMatrix output(
        tatami::make_DelayedBind<1>(std::move(collected)), 
        std::vector<size_t>(as_vec.begin(), as_vec.end())
    );
    output.is_permuted = false;

    return output;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cbind) {
    emscripten::function("cbind", &cbind);
}
/**
 * @endcond
 */

