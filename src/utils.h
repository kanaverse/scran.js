#ifndef UTILS_H
#define UTILS_H

#include <vector>
#include <cstdint>
#include <cmath>

#include "scran_blocks/scran_blocks.hpp"
#include "sanisizer/sanisizer.hpp"

template<typename Input_>
using I = typename std::remove_reference<typename std::remove_cv<Input_>::type>::type;

typedef double JsFakeInt;

template<typename Input_>
JsFakeInt int2js(Input_ x) {
    static_assert(std::numeric_limits<Input_>::is_integer);
    return sanisizer::to_float<JsFakeInt>(x);
}

template<typename Output_>
Output_ js2int(JsFakeInt x) {
    return sanisizer::from_float<Output_>(x);
}

// Prevent accidentally calling js2int on an integer.
template<typename Output_, typename Input_>
Output_ js2int(Input_ x) = delete;

template<typename T>
std::vector<T> convert_array_of_offsets(std::size_t n, std::uintptr_t x) {
    auto output = sanisizer::create<std::vector<T> >(n);
    auto ptr = reinterpret_cast<const uint64_t*>(x); 
    for (I<decltype(n)> i = 0; i < n; ++i) {
        std::uintptr_t current = ptr[i];
        output[i] = reinterpret_cast<T>(current);
    }
    return output;
}

template<bool row>
void check_subset_indices(const std::int32_t* ptr, std::size_t len, std::int32_t limit) {
    for (I<decltype(len)> i = 0; i < len; ++i) {
        if (ptr[i] < 0) {
            throw std::runtime_error("subset indices should be non-negative");
        } else if (ptr[i] >= limit) {
            throw std::runtime_error("subset indices should be less than the number of " + (row ? std::string("rows") : std::string("columns")));
        }
    }
}

inline scran_blocks::WeightPolicy translate_block_weight_policy(const std::string& policy) {
    if (policy == "equal") {
        return scran_blocks::WeightPolicy::EQUAL;
    } else if (policy == "none") {
        return scran_blocks::WeightPolicy::NONE;
    } else if (policy != "variable") {
        throw std::runtime_error("unknown weight policy '" + policy + "'");
    }
    return scran_blocks::WeightPolicy::VARIABLE;
}

#endif
