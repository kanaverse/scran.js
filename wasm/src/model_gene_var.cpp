#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran/feature_selection/ModelGeneVar.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

/**
 * Model the variance of the log-expression values for each gene, accounting for the mean-variance trend.
 *
 * @param mat An input log-expression matrix containing features in rows and cells in columns.
 * @param span The span of the LOWESS smoother for fitting the mean-variance trend.
 *
 * @param use_blocks Whether or not to compute the statistics within each block.
 * @param blocks If `use_blocks = true`, offset to an array of `int32_t`s with `ncells` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 * If `use_blocks = false`, this value is ignored.
 *
 * @param[out] means Offset to an array of offsets of length equal to the number of blocks (or 1, if `use_blocks = false`).
 * Each internal offset points to an output buffer of `double`s with `mat.nrow()` elements, to hold the mean of each feature in each block.
 * @param[out] variances Offset to an array of offsets of length equal to the number of blocks (or 1, if `use_blocks = false`).
 * Each internal offset points to an output buffer of `double`s with `mat.nrow()` elements, to hold the variance of each feature in each block.
 * @param[out] fitted Offset to an array of offsets of length equal to the number of blocks (or 1, if `use_blocks = false`).
 * Each internal offset points to an output buffer of `double`s with `mat.nrow()` elements, to hold the fitted value of the trend for each feature in each block.
 * @param[out] residuals Offset to an array of offsets of length equal to the number of blocks (or 1, if `use_blocks = false`).
 * Each internal offset points to an output buffer of `double`s with `mat.nrow()` elements, to hold the residual from the trend for each feature in each block.
 *
 * @return The buffers in `means`, `variances`, `fitted` and `residuals` are filled.
 * If `use_block = true`, statistics are computed separately for the cells in each block.
 */
void model_gene_var(const NumericMatrix& mat,

                         bool use_blocks, 
                         uintptr_t blocks,
                         double span, 

                         uintptr_t means,
                         uintptr_t variances,
                         uintptr_t fitted,
                         uintptr_t residuals
                         ) 
{
    scran::ModelGeneVar var;
    var.set_span(span);
    auto block_info = add_blocks(use_blocks, blocks, mat.ncol());

    int nblocks = 1;
    if (use_blocks) {
        nblocks = *std::max_element(block_info.first, block_info.first + mat.ncol()) + 1;
    }

    var.run(mat.ptr.get(),
        block_info.first,
        cast_vector_of_pointers<double*>(means, nblocks),
        cast_vector_of_pointers<double*>(variances, nblocks),
        cast_vector_of_pointers<double*>(fitted, nblocks),
        cast_vector_of_pointers<double*>(residuals, nblocks)
    );

    return;
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(model_gene_var) {
    emscripten::function("model_gene_var", &model_gene_var);
}
/**
 * @endcond 
 */

