#include <emscripten/bind.h>

#include <vector>
#include <cstdint>

#include "NeighborIndex.h"
#include "mnncorrect/mnncorrect.hpp"

void mnn_correct(
    size_t nrows, 
    size_t ncols, 
    uintptr_t input, 
    uintptr_t batch, 
    uintptr_t output,
    int k, 
    double nmads, 
    int riters, 
    double rtrim,
    std::string ref_policy, 
    bool approximate,
    int nthreads)
{
    auto bptr = reinterpret_cast<const int32_t*>(batch);
    auto iptr = reinterpret_cast<const double*>(input);
    auto optr = reinterpret_cast<double*>(output);

    mnncorrect::Options options;
    options.num_neighbors = k;
    options.num_mads = nmads;
    options.robust_iterations = riters;
    options.robust_trim = rtrim;
    options.num_threads = nthreads;
    options.builder = create_builder(approximate);

    if (ref_policy == "max-variance") {
        options.reference_policy = mnncorrect::ReferencePolicy::MAX_VARIANCE;
    } else if (ref_policy == "max-rss") {
        options.reference_policy = mnncorrect::ReferencePolicy::MAX_RSS;
    } else if (ref_policy == "max-size") {
        options.reference_policy = mnncorrect::ReferencePolicy::MAX_SIZE;
    } else if (ref_policy == "input") {
        options.reference_policy = mnncorrect::ReferencePolicy::INPUT;
    } else {
        throw std::runtime_error("unknown reference policy '" + ref_policy + "'");
    }

    mnncorrect::compute(
        nrows,
        ncols,
        iptr,
        bptr,
        optr,
        options
    );
}

EMSCRIPTEN_BINDINGS(mnn_correct) {
    emscripten::function("mnn_correct", &mnn_correct, emscripten::return_value_policy::take_ownership());
}
