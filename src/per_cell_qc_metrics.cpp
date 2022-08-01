#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "PerCellQCMetrics_Results.h"
#include "parallel.h"

#include "scran/quality_control/PerCellRnaQcMetrics.hpp"
#include "tatami/base/DelayedSubsetBlock.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

PerCellQCMetrics_Results per_cell_qc_metrics(const NumericMatrix& mat, int nsubsets, uintptr_t subsets, bool proportions, int nthreads) {
    scran::PerCellQCMetrics qc;
    qc.set_subset_totals(!proportions).set_num_threads(nthreads);
    auto store = qc.run(mat.ptr.get(), convert_array_of_offsets<const uint8_t*>(nsubsets, subsets));
    return PerCellQCMetrics_Results(std::move(store), proportions);
}

EMSCRIPTEN_BINDINGS(per_cell_qc_metrics) {
    emscripten::function("per_cell_qc_metrics", &per_cell_qc_metrics);

    emscripten::class_<PerCellQCMetrics_Results>("PerCellQCMetrics_Results")
        .constructor<int, int, bool>()
        .function("sums", &PerCellQCMetrics_Results::sums)
        .function("detected", &PerCellQCMetrics_Results::detected)
        .function("subset_proportions", &PerCellQCMetrics_Results::subset_proportions)
        .function("num_subsets", &PerCellQCMetrics_Results::num_subsets)
        .function("is_proportion", &PerCellQCMetrics_Results::is_proportion)
        ;
}
