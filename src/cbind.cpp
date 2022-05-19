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

    } else if (!first.is_reorganized) {
        for (int i = 1; i < n; ++i) {
            const auto& current = *(mat_ptrs[i]);
            if (!current.is_reorganized) {
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
            if (!current.is_reorganized) {
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

    auto bound = tatami::make_DelayedBind<1>(std::move(collected));
    if (first.is_reorganized) {
        return NumericMatrix(std::move(bound), first.row_ids);
    } else {
        return NumericMatrix(std::move(bound));
    }
}

NumericMatrix cbind_with_rownames(int n, uintptr_t mats, uintptr_t names, uintptr_t indices) {
    if (n == 0) {
        throw std::runtime_error("need at least one matrix to cbind");
    }

    auto mat_ptrs = convert_array_of_offsets<const NumericMatrix*>(n, mats);
    const auto& first = *(mat_ptrs[0]);
    std::vector<std::remove_reference<decltype(first.ptr)>::type> inputs;
    inputs.reserve(n);
    for (int i = 0; i < n; ++i) {
        inputs.push_back(mat_ptrs[i]->ptr);
    }

    auto name_ptrs = convert_array_of_offsets<const int32_t*>(n, names);
    auto out = tatami::bind_intersection<1>(inputs, name_ptrs);

    // Save the direct row indices for the first matrix.
    auto& idx = out.second;
    auto idptr = reinterpret_cast<int*>(indices);
    std::copy(idx.begin(), idx.end(), idptr);

    // Adjust 'ids' so that they refer to the _original_ identifiers for the
    // first matrix, as expected for the 'row_ids' field of the NumericMatrix.
    // Of course, if the first matrix wasn't reorganized, then the 'ids' are
    // already referring to the original identifiers, so no change is required.
    if (first.is_reorganized) {
        for (auto& y : idx) {
            y = first.row_ids[y];
        }
    }

    return NumericMatrix(std::move(out.first), std::move(idx));
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

