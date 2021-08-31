#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "PerCellQCMetrics_Results.h"

#include "scran/quality_control/PerCellQCMetrics.hpp"
#include "tatami/base/DelayedSubsetBlock.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

#ifdef __EMSCRIPTEN_PTHREADS__ 
#include <thread>
#endif

/**
 * @file per_cell_qc_metrics.cpp
 *
 * @brief Compute per-cell QC metrics from the count matrix.
 */

/**
 * Compute some basic per-cell QC metrics.
 *
 * @param mat A `NumericMatrix` object containing features in rows and cells in columns.
 * @param nsubsets Number of feature subsets to be considered.
 * @param[in] subsets Offset to a 2D array of `uint8_t`s with number of rows and columns equal to `mat.nrow()` and `nsubsets`, respectively.
 * The array should be column-major where each column corresponds to a feature subset and each value indicates whether each feature in `mat` belongs to that subset.
 *
 * @return A `PerCellQCMetrics_Results` object that can be interrogated to obtain each QC metric.
 */
PerCellQCMetrics_Results per_cell_qc_metrics(const NumericMatrix& mat, int nsubsets, uintptr_t subsets) {
#ifdef __EMSCRIPTEN_PTHREADS__
    constexpr int nworkers = EMSCRIPTEN_NUM_THREADS;
    scran::PerCellQCMetrics::Results full_output(mat.ncol(), nsubsets);
    double* outsum = full_output.sums.data();
    int* outdet = full_output.detected.data();

    std::vector<double*> outprop(nsubsets);
    for (int i = 0; i < nsubsets; ++i) {
        outprop[i] = full_output.subset_proportions[i].data();
    }

    auto subptrs = extract_column_pointers<const uint8_t*>(subsets, mat.nrow(), nsubsets);

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
        qc.run(current.get(), subptrs, outsum + left, outdet + left, std::move(propcopy));
    };

    for (int w = 0; w < nworkers && first < mat.ncol(); ++w) {
        int last = std::min(first + jobs_per_worker, static_cast<int>(mat.ncol()));
        workers.emplace_back(std::thread(executor, first, last));
    }

    for (auto& wrk : workers) {
        wrk.join();
    }

    return PerCellQCMetrics_Results(std::move(full_output));
#else
    scran::PerCellQCMetrics qc;
    auto store = qc.run(mat.ptr.get(), extract_column_pointers<const uint8_t*>(subsets, mat.nrow(), nsubsets));
    return PerCellQCMetrics_Results(std::move(store));
#endif
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(per_cell_qc_metrics) {
    emscripten::function("per_cell_qc_metrics", &per_cell_qc_metrics);

    emscripten::class_<PerCellQCMetrics_Results>("PerCellQCMetrics_Results")
        .function("sums", &PerCellQCMetrics_Results::sums)
        .function("detected", &PerCellQCMetrics_Results::detected)
        .function("subset_proportions", &PerCellQCMetrics_Results::subset_proportions)
        ;
}
/**
 * @endcond 
 */
