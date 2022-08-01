#include <emscripten/bind.h>

#include <vector>
#include <cstdint>

#include "parallel.h"

#include "mnncorrect/MnnCorrect.hpp"

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

    mnncorrect::MnnCorrect<int, double> runner;
    runner.set_num_neighbors(k).set_num_mads(nmads).set_robust_iterations(riters).set_robust_trim(rtrim).set_approximate(approximate).set_num_threads(nthreads);

    if (ref_policy == "max-variance") {
        runner.set_reference_policy(mnncorrect::MaxVariance);
    } else if (ref_policy == "max-rss") {
        runner.set_reference_policy(mnncorrect::MaxRss);
    } else if (ref_policy == "max-size") {
        runner.set_reference_policy(mnncorrect::MaxSize);
    } else if (ref_policy == "input") {
        runner.set_reference_policy(mnncorrect::Input);
    } else {
        throw std::runtime_error("unknown reference policy '" + ref_policy + "'");
    }

    runner.run(nrows, ncols, iptr, bptr, optr);

    return;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(mnn_correct) {
    emscripten::function("mnn_correct", &mnn_correct);
}
/**
 * @endcond
 */
