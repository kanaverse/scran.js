#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "subpar/subpar.hpp"
#include "phyper/phyper.hpp"

void hypergeometric_test(
    int ntests,
    bool multi_markers_in_set, 
    uintptr_t markers_in_set, 
    bool multi_set_size, 
    uintptr_t set_size, 
    bool multi_num_markers, 
    uintptr_t num_markers, 
    bool multi_num_features, 
    uintptr_t num_features, 
    uintptr_t output,
    bool log, 
    int nthreads) 
{
    const int32_t* misptr = reinterpret_cast<const int32_t*>(markers_in_set);
    const int32_t* ssptr = reinterpret_cast<const int32_t*>(set_size);
    const int32_t* nmptr = reinterpret_cast<const int32_t*>(num_markers);
    const int32_t* nfptr = reinterpret_cast<const int32_t*>(num_features);
    double* outptr = reinterpret_cast<double*>(output);

    subpar::parallelize_range(nthreads, ntests, [&](int, int first, int length) {
        phyper::Options hopt;
        hopt.log = log;

        for (int i = first, last = first + length; i < last; ++i) {
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
    }); 
}

EMSCRIPTEN_BINDINGS(hypergeometric_test) {
    emscripten::function("hypergeometric_test", &hypergeometric_test, emscripten::return_value_policy::take_ownership());
}
