#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran/quality_control/PerCellQCMetrics.hpp"

#include <vector>
#include <cstdint>

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
                         uintptr_t proportions) 
{
    scran::PerCellQCMetrics qc;

    if (nsubsets) {
        qc.set_subsets(cast_vector_of_pointers<const uint8_t*>(subsets, nsubsets));
    }

    qc.run(mat.ptr.get(), 
           reinterpret_cast<double*>(sums),  
           reinterpret_cast<int32_t*>(detected),  
           cast_vector_of_pointers<double*>(proportions, nsubsets)
    );

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
