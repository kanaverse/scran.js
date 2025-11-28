#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "subpar/subpar.hpp"
#include "phyper/phyper.hpp"

void hypergeometric_test(
    JsFakeInt ntests_raw,
    bool multi_markers_in_set, 
    std::uintptr_t markers_in_set, 
    bool multi_set_size, 
    std::uintptr_t set_size, 
    bool multi_num_markers, 
    std::uintptr_t num_markers, 
    bool multi_num_features, 
    std::uintptr_t num_features, 
    std::uintptr_t output,
    bool log, 
    JsFakeInt nthreads_raw
) {
    const auto ntests = js2int<std::size_t>(ntests_raw);
    const auto misptr = reinterpret_cast<const std::int32_t*>(markers_in_set);
    const auto ssptr = reinterpret_cast<const std::int32_t*>(set_size);
    const auto nmptr = reinterpret_cast<const std::int32_t*>(num_markers);
    const auto nfptr = reinterpret_cast<const std::int32_t*>(num_features);
    double* outptr = reinterpret_cast<double*>(output);

    subpar::parallelize_range(
        js2int<int>(nthreads_raw),
        ntests,
        [&](int, I<decltype(ntests)> first, I<decltype(ntests)> length) {
            phyper::Options hopt;
            hopt.log = log;

            for (I<decltype(ntests)> i = first, last = first + length; i < last; ++i) {
                // We'll interpret the genes in the set as white balls,
                // the features _not_ in the set as black balls,
                // and the number of markers as the number of draws.
                auto num_white = ssptr[multi_set_size ? i : 0];
                auto num_black = nfptr[multi_num_features ? i : 0] - num_white;

                outptr[i] = phyper::compute(
                    misptr[multi_markers_in_set ? i : 0],
                    num_white,
                    num_black,
                    nmptr[multi_num_markers ? i : 0],
                    hopt
                );
            }
        }
    ); 
}

EMSCRIPTEN_BINDINGS(hypergeometric_test) {
    emscripten::function("hypergeometric_test", &hypergeometric_test, emscripten::return_value_policy::take_ownership());
}
