#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran/differential_analysis/ScoreMarkers.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

/**
 * Identify potential markers for groups of cells with a range of effect size statistics.
 *
 * @param mat An input log-expression matrix containing features in rows and cells in columns.
 * @param groups Offset to an array of `int32_t`s with `ncells` elements, containing the group assignment for each cell.
 * Group IDs should be consecutive and 0-based.
 * @param use_blocks Whether or not to compute the statistics within each block.
 * @param blocks If `use_blocks = true`, offset to an array of `int32_t`s with `ncells` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 * If `use_blocks = false`, this value is ignored.
 *
 * @param[out] means 
 * If `use_blocks = false`, an offset to a 2D array of `double`s to hold the mean log-expression of each feature in each group.
 * If `use_blocks = true`, this should be an offset to a 3D array of `double`s instead.
 * @param[out] detected 
 * If `use_blocks = false`, an offset to a 2D array of `double`s to hold the proportion of cells with detectable expression of each feature in each group.
 * If `use_blocks = true`, this should be an offset to a 3D array of `double`s instead.
 * @param[out] min_cohen An offset to a 2D array of `double`s to hold the minimum Cohen's d from pairwise comparisons between groups.
 * @param[out] mean_cohen An offset to a 2D array of `double`s to hold the mean Cohen's d from pairwise comparisons between groups.
 * @param[out] rank_cohen An offset to a 2D array of `double`s to hold the minimum rank of the Cohen's d values from pairwise comparisons between groups.
 * 
 * @return The arrays in `means`, `variances`, `fitted` and `residuals` are filled.
 * If `use_block = true`, statistics are computed separately for the cells in each block.
 * 
 * All of the output 2D arrays in this function should have number of rows and columns equal to the number of features and groups, respectively.
 * Filling of each array is done in column major format such that all values corresponding to the same group are contiguous.
 *
 * For the output 3D arrays, the first, second and third dimensions are expected to correspond to features, groups and blocks, respectively.
 * The first dimension should be the fastest changing dimension while the third dimension is the slowest.
 * In other words, all values for the same group/block combination are contiguous; then all values in the same block are contiguous.
 */
void score_markers(const NumericMatrix& mat,
    uintptr_t groups,

    bool use_blocks, 
    uintptr_t blocks,

    uintptr_t means,
    uintptr_t detected,

    uintptr_t min_cohen,
    uintptr_t mean_cohen,
    uintptr_t rank_cohen
) {
    scran::ScoreMarkers mrk;
    const int32_t* gptr = reinterpret_cast<const int32_t*>(groups);
    size_t ncells = mat.ptr->ncol();
    size_t ngenes = mat.ptr->nrow();
    size_t ngroups = (ncells ? *std::max_element(gptr, gptr + ncells) : 0);

    double* min_cohen_ptr = reinterpret_cast<double*>(min_cohen);
    double* mean_cohen_ptr = reinterpret_cast<double*>(mean_cohen);
    double* rank_cohen_ptr = reinterpret_cast<double*>(rank_cohen);

    std::vector<std::vector<double*> > cohen_ptrs(ngroups);
    for (size_t g = 0; g < ngroups; ++g) {
        cohen_ptrs[g].push_back(min_cohen_ptr);
        min_cohen_ptr += ngenes;
        cohen_ptrs[g].push_back(mean_cohen_ptr);
        mean_cohen_ptr += ngenes;
        cohen_ptrs[g].push_back(NULL); // median
        cohen_ptrs[g].push_back(rank_cohen_ptr);
        rank_cohen_ptr += ngenes;
    }

    if (use_blocks) {
        const int32_t* bptr = reinterpret_cast<const int32_t*>(blocks);
        int nblocks = *std::max_element(bptr, bptr + mat.ncol()) + 1;
        mrk.run_blocked(mat.ptr.get(), gptr, bptr,
            extract_column_pointers_blocked<double*>(means, ngenes, ngroups, nblocks),
            extract_column_pointers_blocked<double*>(detected, ngenes, ngroups, nblocks),
            std::move(cohen_ptrs)
        );
    } else {
        mrk.run(mat.ptr.get(), gptr, 
            extract_column_pointers<double*>(means, ngenes, ngroups),
            extract_column_pointers<double*>(detected, ngenes, ngroups),
            std::move(cohen_ptrs)
        );
    }

    return;
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(score_markers) {
    emscripten::function("score_markers", &score_markers);
}
/**
 * @endcond 
 */

