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

    if (same_perm) {
        for (int i = 1; i < n; ++i) {
            const auto& current = *(mat_ptrs[i]);
            collected.push_back(current.ptr);
        }

    } else if (!first.is_permuted) {
        for (int i = 1; i < n; ++i) {
            const auto& current = *(mat_ptrs[i]);
            if (!current.is_permuted) {
                collected.push_back(current.ptr);
            } else {
                std::vector<size_t> permutation(NR);
                const auto& cur_ids = current.row_ids;
                for (size_t i = 0; i < cur_ids.size(); ++i) {
                    if (cur_ids[i] >= NR) {
                        throw std::runtime_error("row identity (" + std::to_string(cur_ids[i]) + ") in matrix " + std::to_string(i + 1) + " has no counterpart in the first matrix");
                    }
                    permutation[cur_ids[i]] = i;
                }
                collected.push_back(tatami::make_DelayedSubset<0>(current.ptr, std::move(permutation)));
            }
        }

    } else {
        std::unordered_map<size_t, size_t> mapping;
        const auto& first_ids = first.row_ids;  
        for (size_t i = 0; i < first_ids.size(); ++i) {
            mapping[first_ids[i]] = i;
        }

        for (int i = 1; i < n; ++i) {
            const auto& current = *(mat_ptrs[i]);
            std::vector<size_t> permutation(NR);
            if (!current.is_permuted) {
                for (size_t i = 0; i < NR; ++i) {
                    auto it = mapping.find(i);
                    if (it == mapping.end()) {
                        throw std::runtime_error("row identity (" + std::to_string(i) + ") in matrix " + std::to_string(i + 1) + " has no counterpart in the first matrix");
                    }
                    permutation[it->second] = i;
                }
            } else {
                const auto& cur_ids = current.row_ids;
                for (size_t i = 0; i < cur_ids.size(); ++i) {
                    auto it = mapping.find(cur_ids[i]);
                    if (it == mapping.end()) {
                        throw std::runtime_error("row identity (" + std::to_string(cur_ids[i]) + ") in matrix " + std::to_string(i + 1) + " has no counterpart in the first matrix");
                    }
                    permutation[it->second] = i;
                }
            }
            collected.push_back(tatami::make_DelayedSubset<0>(current.ptr, std::move(permutation)));
        }
    }

    return NumericMatrix(tatami::make_DelayedBind<1>(std::move(collected)));
}

NumericMatrix cbind_with_rownames(int n, uintptr_t mats, uintptr_t names) {
    if (n == 0) {
        throw std::runtime_error("need at least one matrix to cbind");
    }

    auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n, mats);
    const auto& first = *(mat_ptrs.front());

    // Harvesting the commons.
    auto name_ptrs = convert_array_of_offsets<const int32_t*>(n, names);
    auto first_names = name_ptrs[0];
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

    return NumericMatrix(tatami::make_DelayedBind<1>(std::move(collected)), std::vector<size_t>(as_vec.begin(), as_vec.end()));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cbind) {
    emscripten::function("cbind", &cbind);

    emscripten::function("cbind_with_rownames", &cbind_with_rownames);
}
/**
 * @endcond
 */

