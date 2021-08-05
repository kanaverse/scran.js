#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran/quality_control/PerCellQCFilters.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

/**
 * Apply a typical filtering step on the per-cell QC metrics, by removing cells that have undesirable outlier values.
 *
 * @param ncells Number of cells, and the length of all vectors discussed here.
 * @param[in] sums Offset to an input buffer of `double`s with `ncells` elements, containing the total sum of counts for all cells.
 * @param[in] detected Offset to an input buffer of `int32_t`s with `ncells` elements, containing the number of detected features for all cells.
 * @param nsubsets Number of feature subsets to be considered.
 * @param[in] proportions Offset to a 2D array of `double`s with number of rows and columns equal to `ncells` and `nsubsets`, respectively.
 * The array is column-major where each column contains the proportion of counts assigned to a particular feature subset in each cell.
 *
 * @param use_blocks Whether or not to compute the default filters within each block.
 * @param[in] blocks If `use_blocks = true`, offset to an array of `int32_t`s with `ncells` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 * If `use_blocks = false`, this value is ignored.
 * @param nmads Number of MADs from the median, to use for defining outliers.
 *
 * @param[out] discard_sums Offset to an output buffer of `uint8_t`s with `ncells` elements,
 * indicating whether a cell should be discarded because its log-total count is a small outlier.
 * @param[out] discard_detected Offset to an output buffer of `uint8_t`s with `ncells` elements,
 * indicating whether a cell should be discarded because its log-number of detected genes is a small outlier.
 * @param[out] discard_proportions Offset to a 2D array of `uint8_t`s with number of rows and columns equal to `ncells` and `nsubsets`, respectively.
 * The array is column-major where each column corresponds to a feature subset;
 * each value indicates whether a cell should be discarded because the proportion of that subset is a large outlier.
 * @param[out] discard_overall Offset to a buffer of `uint8_t`s with `ncells` elements,
 * indicating whether a cell should be discarded for any of the previous reasons.
 *
 * @param[out] threshold_sums Offset to an output buffer of `double`s of length equal to the number of blocks (if `use_blocks = true`) or 1 (otherwise),
 * specifying the lower bound on the total sum of counts for each block.
 * @param[out] threshold_detected Offset to an output buffer of `double`s of length equal to the number of blocks (if `use_blocks = true`) or 1 (otherwise),
 * specifying the lower bound on the number of detected features for each block.
 * @param[out] threshold_proportions Offset to a 2D array of `double`s with number of rows and columns equal to `nsubsets` and the number of blocks, respectively.
 * (If `use_blocks = false`, the number of blocks is assumed to be 1.)
 * The array is column-major where each column corresponds to a block;
 * each value contains the upper bound on the proportion of a feature subset (row) in that block.
 *
 * @return All buffers in `discard_sums`, `discard_detected`, `discard_proportions` and `discard_overall` are filled.
 */
void per_cell_qc_filters(int ncells, 
                         uintptr_t sums, 
                         uintptr_t detected, 
                         int nsubsets, 
                         uintptr_t proportions,

                         bool use_blocks, 
                         uintptr_t blocks,
                         double nmads,

                         uintptr_t discard_sums, 
                         uintptr_t discard_detected, 
                         uintptr_t discard_proportions, 
                         uintptr_t discard_overall,
                         
                         uintptr_t threshold_sums,
                         uintptr_t threshold_detected,
                         uintptr_t threshold_proportions
                         ) 
{
    scran::PerCellQCFilters qc;
    qc.set_nmads(nmads);

    const uint32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const uint32_t*>(blocks);
    }

    auto thresholds = qc.run_blocked(ncells, 
                                     bptr, 
                                     reinterpret_cast<const double*>(sums),
                                     reinterpret_cast<const int32_t*>(detected),
                                     extract_column_pointers<const double*>(proportions, ncells, nsubsets),
                                     reinterpret_cast<uint8_t*>(discard_sums),
                                     reinterpret_cast<uint8_t*>(discard_detected),
                                     extract_column_pointers<uint8_t*>(discard_proportions, ncells, nsubsets),
                                     reinterpret_cast<uint8_t*>(discard_overall)
    );

    return;
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(per_cell_qc_filters) {
    emscripten::function("per_cell_qc_filters", &per_cell_qc_filters);
}
/**
 * @endcond 
 */

