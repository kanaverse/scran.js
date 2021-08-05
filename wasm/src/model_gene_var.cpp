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
 * If `false`, the number of blocks is assumed to be 1, otherwise it is determined from the maximum value of `blocks`.
 * @param blocks If `use_blocks = true`, offset to an array of `int32_t`s with `ncells` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 * If `use_blocks = false`, this value is ignored.
 *
 * @param[out] means Offset to a 2D array of `double` with number of rows and columns equal to `mat.nrow()` and the number of blocks, respectively.
 * Each column contains the mean log-expression of each feature in the corresponding block. 
 * @param[out] variances Offset to a 2D array of `double` with number of rows and columns equal to `mat.nrow()` and the number of blocks, respectively.
 * Each column contains the variance of log-expression of each feature in the corresponding block. 
 * @param[out] fitted Offset to a 2D array of `double` with number of rows and columns equal to `mat.nrow()` and the number of blocks, respectively.
 * Each column contains the fitted value of the trend of each feature in the corresponding block. 
 * @param[out] residuals Offset to a 2D array of `double` with number of rows and columns equal to `mat.nrow()` and the number of blocks, respectively.
 * Each column contains the residual from the trend of each feature in the corresponding block. 
 *
 * @return The arrays in `means`, `variances`, `fitted` and `residuals` are filled.
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

    if (use_blocks) {
        const int32_t* bptr = reinterpret_cast<const int32_t*>(blocks);
        int nblocks = *std::max_element(bptr, bptr + mat.ncol()) + 1;
        var.run_blocked(mat.ptr.get(), bptr,
            extract_column_pointers<double*>(means, mat.nrow(), nblocks),
            extract_column_pointers<double*>(variances, mat.nrow(), nblocks),
            extract_column_pointers<double*>(fitted, mat.nrow(), blocks),
            extract_column_pointers<double*>(residuals, mat.nrow(), nblocks)
        );
    } else {
        var.run(mat.ptr.get(),
            reinterpret_cast<double*>(means),
            reinterpret_cast<double*>(variances),
            reinterpret_cast<double*>(fitted),
            reinterpret_cast<double*>(residuals)
        );
    }

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

