#include <emscripten/bind.h>

#include <vector>
#include <cmath>
#include <algorithm>

#include "NumericMatrix.h"
#include "parallel.h"

#include "scran/dimensionality_reduction/RunPCA.hpp"
#include "scran/dimensionality_reduction/MultiBatchPCA.hpp"
#include "scran/dimensionality_reduction/BlockedPCA.hpp"

/**
 * @file run_pca.cpp
 *
 * @brief Compute the top principal components in the log-expression matrix.
 */

/**
 * @brief Template for Javascript-visible wrappers around `scran::RunPCA::Results` and relatives.
 */
template<class Store>
struct PCA_Results {
    /**
     * @cond
     */
    PCA_Results(Store s) : store(std::move(s)) {}

    Store store;
    /**
     * @endcond
     */

    PCA_Results(int num_cells, int num_pcs) {
        store.pcs.resize(num_pcs, num_cells);
        store.variance_explained.resize(num_pcs);
        return;
    }


    /**
     * @return `Float64Array` view into a column-major 2D array of PCs.
     * Each row is a PC and each column is a cell.
     */
    emscripten::val pcs() const {
        return emscripten::val(emscripten::typed_memory_view(store.pcs.cols() * store.pcs.rows(), store.pcs.data()));
    }

    /**
     * @return `Float64Array` view containing the variance explained by each PC.
     */
    emscripten::val variance_explained() const {
        return emscripten::val(emscripten::typed_memory_view(store.variance_explained.size(), store.variance_explained.data()));
    }

    /**
     * @return `Float64Array` view containing the total variance of the input matrix.
     */
    double total_variance() const {
        return store.total_variance;
    }

    void set_total_variance(double v) {
        store.total_variance = v;
        return;
    }

    /**
     * @return Number of cells.
     */
    int num_cells() const {
        return store.pcs.cols();
    }

    /**
     * @return Number of PCs.
     */
    int num_pcs() const {
        return store.variance_explained.size();
    }
};

/**
 * Realization of `PCA_Results` to wrap `scran::RunPCA` output.
 */
using RunPCA_Results = PCA_Results<scran::RunPCA::Results>;

const uint8_t* precheck_inputs(int number, size_t NC, bool use_subset, uintptr_t subset) {
    if (number < 1) {
        throw std::runtime_error("requested number of PCs should be positive");
    }
    if (NC < number) {
        throw std::runtime_error("fewer cells than the requested number of PCs");
    }
    const uint8_t* subptr = NULL;
    if (use_subset) {
        subptr = reinterpret_cast<const uint8_t*>(subset);
    }
    return subptr;
}

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
 *
 * @return A `RunPCA_Results` object is returned containing the PCA results.
 */
RunPCA_Results run_pca(const NumericMatrix& mat, int number, bool use_subset, uintptr_t subset, bool scale, int nthreads) {
    auto ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();

    auto subptr = precheck_inputs(number, NC, use_subset, subset);

    scran::RunPCA pca;
    pca.set_rank(number).set_scale(scale).set_num_threads(nthreads);
    auto result = pca.run(ptr.get(), subptr);

    return RunPCA_Results(std::move(result)); 
}

/**
 * Realization of `PCA_Results` to wrap `scran::BlockedPCA` output.
 */
using BlockedPCA_Results = PCA_Results<scran::BlockedPCA::Results>;

/**
 * Perform a principal components analysis after blocking on a factor across the cells.
 * This is equivalent to performing a PCA on the residuals after regressing out the factor.
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
 * @param[in] blocks Offset to an array of `int32_t`s with `ncells` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 *
 * @return A `BlockedPCA_Results` object is returned containing the PCA results.
 */
BlockedPCA_Results run_blocked_pca(const NumericMatrix& mat, int number, bool use_subset, uintptr_t subset, bool scale, uintptr_t blocks, int nthreads) {
    auto ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();

    auto subptr = precheck_inputs(number, NC, use_subset, subset);
    auto bptr = reinterpret_cast<const int32_t*>(blocks);

    scran::BlockedPCA pca;
    pca.set_rank(number).set_scale(scale).set_num_threads(nthreads);
    auto result = pca.run(ptr.get(), bptr, subptr);

    return BlockedPCA_Results(std::move(result)); 
}

/**
 * Realization of `PCA_Results` to wrap `scran::MultiBatchPCA` output.
 */
using MultiBatchPCA_Results = PCA_Results<scran::MultiBatchPCA::Results>;

/**
 * Perform a principal components analysis after equalizing the contribution of each batch to the rotation vectors.
 * This ensures that larger batches to not solely determine the axes of the low-dimensional space.
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
 * @param[in] blocks Offset to an array of `int32_t`s with `ncells` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 *
 * @return A `MultiBatchPCA_Results` object is returned containing the PCA results.
 */
MultiBatchPCA_Results run_multibatch_pca(const NumericMatrix& mat, int number, bool use_subset, uintptr_t subset, bool scale, uintptr_t blocks, int nthreads) {
    auto ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();

    auto subptr = precheck_inputs(number, NC, use_subset, subset);
    auto bptr = reinterpret_cast<const int32_t*>(blocks);

    scran::MultiBatchPCA pca;
    pca.set_rank(number).set_scale(scale).set_num_threads(nthreads);
    auto result = pca.run(ptr.get(), bptr, subptr);

    return MultiBatchPCA_Results(std::move(result)); 
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(run_pca) {
    emscripten::function("run_pca", &run_pca);

    emscripten::function("run_blocked_pca", &run_blocked_pca);

    emscripten::function("run_multibatch_pca", &run_multibatch_pca);

    emscripten::class_<RunPCA_Results>("RunPCA_Results")
        .constructor<int, int>()
        .function("pcs", &RunPCA_Results::pcs)
        .function("variance_explained", &RunPCA_Results::variance_explained)
        .function("total_variance", &RunPCA_Results::total_variance)
        .function("set_total_variance", &RunPCA_Results::set_total_variance)
        .function("num_cells", &RunPCA_Results::num_cells)
        .function("num_pcs", &RunPCA_Results::num_pcs)
        ;

    emscripten::class_<BlockedPCA_Results>("BlockedPCA_Results")
        .function("pcs", &BlockedPCA_Results::pcs)
        .function("variance_explained", &BlockedPCA_Results::variance_explained)
        .function("total_variance", &BlockedPCA_Results::total_variance)
        .function("num_cells", &BlockedPCA_Results::num_cells)
        .function("num_pcs", &BlockedPCA_Results::num_pcs)
        ;

    emscripten::class_<MultiBatchPCA_Results>("MultiBatchPCA_Results")
        .function("pcs", &MultiBatchPCA_Results::pcs)
        .function("variance_explained", &MultiBatchPCA_Results::variance_explained)
        .function("total_variance", &MultiBatchPCA_Results::total_variance)
        .function("num_cells", &MultiBatchPCA_Results::num_cells)
        .function("num_pcs", &MultiBatchPCA_Results::num_pcs)
        ;
}
/**
 * @endcond
 */

