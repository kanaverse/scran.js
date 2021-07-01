#include <emscripten/bind.h>
#include "NumericMatrix.h"
#include "scran/quality_control/PerCellQCMetrics.hpp"

void per_cell_qc_metrics(const NumericMatrix& mat, uintptr_t subsets, int nsubsets, uintptr_t sums, uintptr_t detected, uintptr_t proportions) {
    scran::PerCellQCMetrics qc;

    if (nsubsets) {
        const uint8_t** subptrs = reinterpret_cast<const uint8_t**>(subsets);
        qc.set_subsets(std::vector<const uint8_t*>(subptrs, subptrs + nsubsets));
    }

    double** propptrs = reinterpret_cast<double**>(proportions);

    qc.run(mat.ptr.get(), 
           reinterpret_cast<double*>(sums),  
           reinterpret_cast<int*>(detected),  
           std::vector<double*>(propptrs, propptrs + nsubsets)
    );

    return;
}

EMSCRIPTEN_BINDINGS(per_cell_qc_metrics) {
    emscripten::function("per_cell_qc_metrics", &per_cell_qc_metrics);
}
