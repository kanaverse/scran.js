#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "scran/dimensionality_reduction/RunPCA.hpp"

#include <vector>
#include <cmath>

/**
 * Perform a principal components analysis to obtain per-cell coordinates in low-dimensional space.
 *
 * @param mat The input log-expression matrix, with features in rows and cells in columns.
 * @param number Number of PCs to obtain.
 * Must be less than the smaller dimension of `mat`.
 * @param use_subset Whether to subset the matrix to features of interest in `subset`.
 * @param[in] subset Offset to an input array of `uint8_t`s of length `mat.nrow()`,
 * indicating which features should be used for the PCA.
 * Only used if `use_subset = true`.
 * @param scale Whether to standardize rows in `mat` to unit variance.
 * If `true`, all rows in `mat` are assumed to have non-zero variance.
 * @param[out] pcs Offset to an output array of `double`s of length `number * mat.ncol()`.
 * @param[out] prop_var Offset to an output array of `double`s of length `number`.
 *
 * @return `pcs` is filled with the PC coordinates in a column-major manner, where each row corresponds to a PC and each column corresponds to a cell.
 * `prop_var` is filled with the percentage of variance explained by each successive PC.
 */
void run_pca(const NumericMatrix& mat, int number, bool use_subset, uintptr_t subset, bool scale, uintptr_t pcs, uintptr_t prop_var) {
    auto ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();
    assert(NC > 1);
    assert(NC > number);

    scran::RunPCA pca;
    pca.set_rank(number).set_scale(scale);

    const uint8_t* subptr = NULL;
    if (use_subset) {
        subptr = reinterpret_cast<const uint8_t*>(subset);
    }
    auto result = pca.run(ptr, subptr);
    
    // Copying over results into the output arrays.
    double* output = reinterpret_cast<double*>(pcs);
    result.pcs.adjointInPlace();
    std::copy(result.pcs.data(), result.pcs.data() + result.pcs.rows() * result.pcs.cols(), output);

    double* output_prop = reinterpret_cast<double*>(prop_var);
    for (auto& x : result.variance_explained) {
        x /= result.total_variance;
    }
    std::copy(result.variance_explained.begin(), result.variance_explained.end(), output_prop);

    return;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(run_pca) {
    emscripten::function("run_pca", &run_pca);
}
/**
 * @endcond
 */

