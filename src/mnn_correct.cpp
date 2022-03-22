#include <emscripten/bind.h>
#include "mnncorrect/MnnCorrect.hpp"
#include <vector>
#include <cstdint>

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
    bool approximate) 
{
    auto bptr = reinterpret_cast<const int32_t*>(batch);
    auto iptr = reinterpret_cast<const double*>(input);
    auto optr = reinterpret_cast<double*>(output);

    mnncorrect::MnnCorrect<int, double> runner;
    runner.set_num_neighbors(k).set_num_mads(nmads).set_robust_iterations(riters).set_robust_trim(rtrim).set_approximate(approximate);
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
