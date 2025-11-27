#include <emscripten/bind.h>

#include <cstdint>
#include <cstddef>

#include "NeighborIndex.h"
#include "utils.h"

#include "mnncorrect/mnncorrect.hpp"

void mnn_correct(
    JsFakeInt nrows_raw, 
    JsFakeInt ncols_raw, 
    std::uintptr_t input, 
    std::uintptr_t batch, 
    std::uintptr_t output,
    JsFakeInt k_raw, 
    JsFakeInt steps_raw,
    std::string merge_policy, 
    bool approximate,
    JsFakeInt nthreads_raw
) {
    auto bptr = reinterpret_cast<const std::int32_t*>(batch);
    auto iptr = reinterpret_cast<const double*>(input);
    auto optr = reinterpret_cast<double*>(output);

    mnncorrect::Options<std::int32_t, double, knncolle::SimpleMatrix<std::int32_t, double> > options;
    options.num_neighbors = js2int<int>(k_raw);
    options.num_steps = js2int<int>(steps_raw);
    options.num_threads = js2int<int>(nthreads_raw);
    options.builder = create_builder(approximate);

    if (merge_policy == "variance") {
        options.merge_policy = mnncorrect::MergePolicy::VARIANCE;
    } else if (merge_policy == "rss") {
        options.merge_policy = mnncorrect::MergePolicy::RSS;
    } else if (merge_policy == "size") {
        options.merge_policy = mnncorrect::MergePolicy::SIZE;
    } else if (merge_policy == "input") {
        options.merge_policy = mnncorrect::MergePolicy::INPUT;
    } else {
        throw std::runtime_error("unknown reference policy '" + merge_policy + "'");
    }

    mnncorrect::compute(
        js2int<std::size_t>(nrows_raw),
        js2int<std::int32_t>(ncols_raw),
        iptr,
        bptr,
        optr,
        options
    );
}

EMSCRIPTEN_BINDINGS(mnn_correct) {
    emscripten::function("mnn_correct", &mnn_correct, emscripten::return_value_policy::take_ownership());
}
