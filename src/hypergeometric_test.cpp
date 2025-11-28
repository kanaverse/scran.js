#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "subpar/subpar.hpp"
#include "phyper/phyper.hpp"

void js_hypergeometric_test(
    JsFakeInt ntests_raw,
    bool multi_markers_in_set, 
    JsFakeInt markers_in_set_raw, 
    bool multi_set_size, 
    JsFakeInt set_size_raw, 
    bool multi_num_markers, 
    JsFakeInt num_markers_raw, 
    bool multi_num_features, 
    JsFakeInt num_features_raw, 
    JsFakeInt output_raw,
    bool log, 
    JsFakeInt nthreads_raw
) {
    const auto ntests = js2int<std::size_t>(ntests_raw);
    const auto misptr = reinterpret_cast<const std::int32_t*>(js2int<std::uintptr_t>(markers_in_set_raw));
    const auto ssptr = reinterpret_cast<const std::int32_t*>(js2int<std::uintptr_t>(set_size_raw));
    const auto nmptr = reinterpret_cast<const std::int32_t*>(js2int<std::uintptr_t>(num_markers_raw));
    const auto nfptr = reinterpret_cast<const std::int32_t*>(js2int<std::uintptr_t>(num_features_raw));
    double* outptr = reinterpret_cast<double*>(js2int<std::uintptr_t>(output_raw));

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
    emscripten::function("hypergeometric_test", &js_hypergeometric_test, emscripten::return_value_policy::take_ownership());
}
