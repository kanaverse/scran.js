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
 * @param[in] subsets Offset to a 2D array of `uint8_t`s with number of rows and columns equal to `mat.nrow()` and `nsubsets`, respectively.
 * The array should be column-major where each column corresponds to a feature subset and each value indicates whether each feature in `mat` belongs to that subset.
 *
 * @param[out] sums Offset to an output buffer of `double`s with `mat.ncol()` elements, containing the total sum of counts for all cells.
 * @param[out] detected Offset to an output buffer of `int32_t`s with `mat.ncol()` elements, containing the number of detected features for all cells.
 * @param[out] proportions Offset to a 2D array of `double`s with number of rows and columns equal to `mat.ncol()` and `subsets`, respectively.
 * The array should be column-major where each column corresponds to a subset and each value contains the proportion of counts assigned to that subset in each cell.
 *
 * @return All arrays in `sums`, `detected`, `proportions` and `discard_overall` are filled.
 */
void per_cell_qc_metrics(const NumericMatrix& mat, 
                         int nsubsets, 
                         uintptr_t subsets, 
                         uintptr_t sums, 
                         uintptr_t detected, 
                         uintptr_t proportions) 
{
    scran::PerCellQCMetrics qc;

    qc.run(mat.ptr.get(), 
           extract_column_pointers<const uint8_t*>(subsets, mat.nrow(), nsubsets),
           reinterpret_cast<double*>(sums),  
           reinterpret_cast<int32_t*>(detected),  
           extract_column_pointers<double*>(proportions, mat.ncol(), nsubsets)
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
