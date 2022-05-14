#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "PerCellAdtQcMetrics_Results.h"

#include "scran/quality_control/PerCellAdtQcMetrics.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

PerCellAdtQcMetrics_Results per_cell_adt_qc_metrics(const NumericMatrix& mat, int nsubsets, uintptr_t subsets) {
    scran::PerCellAdtQcMetrics qc;
    auto store = qc.run(mat.ptr.get(), convert_array_of_offsets<const uint8_t*>(nsubsets, subsets));
    return PerCellAdtQcMetrics_Results(std::move(store));
}

EMSCRIPTEN_BINDINGS(per_cell_qc_metrics) {
    emscripten::function("per_cell_adt_qc_metrics", &per_cell_adt_qc_metrics);

    emscripten::class_<PerCellAdtQcMetrics_Results>("PerCellAdtQcMetrics_Results")
        .constructor<int, int>()
        .function("sums", &PerCellAdtQcMetrics_Results::sums)
        .function("detected", &PerCellAdtQcMetrics_Results::detected)
        .function("subset_totals", &PerCellAdtQcMetrics_Results::subset_totals)
        .function("num_subsets", &PerCellAdtQcMetrics_Results::num_subsets)
        ;
}
