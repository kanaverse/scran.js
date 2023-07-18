#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/scran.hpp"

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
    bool sorted,
    uintptr_t output,
    int nthreads) 
{
    const int32_t* misptr = reinterpret_cast<const int32_t*>(markers_in_set);
    const int32_t* ssptr = reinterpret_cast<const int32_t*>(set_size);
    const int32_t* nmptr = reinterpret_cast<const int32_t*>(num_markers);
    const int32_t* nfptr = reinterpret_cast<const int32_t*>(num_features);

    std::vector<int> indices(ntests);
    std::iota(indices.begin(), indices.end(), 0);

    if (!sorted) {
        std::sort(indices.begin(), indices.end(), [&](int l, int r) -> bool {
            if (multi_num_features) {
                if (nfptr[l] < nfptr[r]) {
                    return true;
                } else if (nfptr[l] > nfptr[r]) {
                    return false;
                }
            }

            if (multi_num_markers) {
                if (nmptr[l] < nmptr[r]) {
                    return true;
                } else if (nmptr[l] > nmptr[r]) {
                    return false;
                }
            }

            if (multi_set_size) {
                if (ssptr[l] < ssptr[r]) {
                    return true;
                } else if (ssptr[l] > ssptr[r]) {
                    return false;
                }
            }

            if (multi_markers_in_set) {
                if (misptr[l] < misptr[r]) {
                    return true;
                } else if (misptr[l] > misptr[r]) {
                    return false;
                }
            }

            return l < r;
        });
    }

    double* outptr = reinterpret_cast<double*>(output);
    scran::HypergeometricTail hyper;

    run_parallel_old(ntests, [&](int first, int last) -> void {
        for (int i = first; i < last; i++) {
            auto x = indices[i];

            // We'll interpret the features in the set as white balls,
            // the features _not_ in the set as black balls,
            // and the number of markers as the number of draws.
            auto num_white = ssptr[multi_set_size ? x : 0];
            auto num_black = nfptr[multi_num_features ? x : 0] - num_white;

            outptr[x] = hyper.run(
                misptr[multi_markers_in_set ? x : 0],
                num_white,
                num_black,
                nmptr[multi_num_markers ? x : 0]
            );
        }
    }, nthreads);

    return;
}

EMSCRIPTEN_BINDINGS(hypergeometric_test) {
    emscripten::function("hypergeometric_test", &hypergeometric_test);
}
