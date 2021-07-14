#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran/quality_control/PerCellQCMetrics.hpp"
#include "tatami/base/DelayedSubsetBlock.hpp"

#include <vector>
#include <cstdint>
#include <thread>
#include <cmath>

/**
 * Compute some basic -cell QC metrics.
 *
 * @param mat A `NumericMatrix` object containing features in rows and cells in columns.
 * @param nsubsets Number of feature subsets to be considered.
 * @param subsets Offset to an array of offsets of length `nsubsets`, where each internal offset points to an input buffer of `uint8_t`s with `ncells` elements.
 * Each referenced buffer indicates whether each feature in `mat` belongs to the corresponding feature subset.
 *
 * @param sums Offset to an output buffer of `double`s with `ncells` elements, containing the total sum of counts for all cells.
 * @param detected Offset to an output buffer of `int32_t`s with `ncells` elements, containing the number of detected features for all cells.
 * @param proportions Offset to an array of offsets of length `subsets`, where each internal offset points to an output buffer of  `double`s with `ncells` elements.
 * Each referenced buffer contains the proportion of counts assigned to a particular feature subset in each cell.
 *
 * @return All buffers in `sums`, `detected`, `proportions` and `discard_overall` are filled.
 */
void per_cell_qc_metrics(const NumericMatrix& mat, 
                         int nsubsets, 
                         uintptr_t subsets, 
                         uintptr_t sums, 
                         uintptr_t detected, 
                         uintptr_t proportions,
                         int nworkers) 
{
    auto insub = cast_vector_of_pointers<const uint8_t*>(subsets, nsubsets);
    auto outsum = reinterpret_cast<double*>(sums);
    auto outdet = reinterpret_cast<int32_t*>(detected);
    auto outprop = cast_vector_of_pointers<double*>(proportions, nsubsets);

#ifdef __EMSCRIPTEN_PTHREADS__ 
    if (nworkers > 1) {
        int jobs_per_worker = std::ceil(static_cast<double>(mat.ncol())/nworkers);
        std::vector<std::thread> workers;
        workers.reserve(nworkers);
        int first = 0; 

        auto executor = [&](int left, int right) -> void {
            auto propcopy = outprop;
            for (auto& p : propcopy) { 
                p += left;
            }
            auto current = tatami::make_DelayedSubsetBlock<1>(mat.ptr, left, right);
            scran::PerCellQCMetrics qc;
            qc.run(mat.ptr.get(), insub, outsum + left, outdet + left, std::move(propcopy));
        };

        for (int w = 0; w < nworkers && first < mat.ncol(); ++w) {
            int last = std::min(first + jobs_per_worker, static_cast<int>(mat.ncol()));
            workers.emplace_back(std::thread(executor, first, last));
        }

        for (auto& wrk : workers) {
            wrk.join();
        }

    } else {
#endif
        scran::PerCellQCMetrics qc;
        qc.run(mat.ptr.get(), std::move(insub), outsum, outdet, std::move(outprop));
#ifdef __EMSCRIPTEN_PTHREADS__ 
    }
#endif

    return;
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(per_cell_qc_metrics) {
    emscripten::function("per_cell_qc_metrics", &per_cell_qc_metrics);
}
/**
 * @endcond 
 */
