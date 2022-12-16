#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "parallel.h"
#include "utils.h"

#include "scran/utils/average_vectors.hpp"
#include "scran/feature_selection/ModelGeneVar.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

/**
 * @file model_gene_var.cpp
 *
 * @brief Model the mean-variance relationship across all genes.
 */

/**
 * @brief Javascript-visible wrapper for `scran::ModelGeneVar::Results`.
 */
struct ModelGeneVar_Results {
    /**
     * @cond
     */
    typedef scran::ModelGeneVar::Results Store;

    ModelGeneVar_Results(Store s) : store(std::move(s)) {
        if (store.means.size() > 1) {
            auto compute_average = [](const std::vector<std::vector<double> >& inputs, std::vector<double>& output) -> void {
                std::vector<const double*> ptrs;
                for (const auto& i : inputs) {
                    ptrs.push_back(i.data());
                }
                size_t n = inputs.front().size();
                output.resize(n);
                scran::average_vectors(n, std::move(ptrs), output.data());
            };

            compute_average(store.means, average_means);
            compute_average(store.variances, average_variances);
            compute_average(store.fitted, average_fitted);
            compute_average(store.residuals, average_residuals);
        }
    }

    Store store;

    std::vector<double> average_means,
        average_variances,
        average_fitted,
        average_residuals;

    ModelGeneVar_Results(int num_genes, int num_blocks) {
        store.means.resize(num_blocks);
        store.variances.resize(num_blocks);
        store.fitted.resize(num_blocks);
        store.residuals.resize(num_blocks);

        for (int b = 0; b < num_blocks; ++b) {
            store.means[b].resize(num_genes);
            store.variances[b].resize(num_genes);
            store.fitted[b].resize(num_genes);
            store.residuals[b].resize(num_genes);
        }

        if (store.means.size() > 1) {
            average_means.resize(num_genes);
            average_variances.resize(num_genes);
            average_fitted.resize(num_genes);
            average_residuals.resize(num_genes);
        }
    }

    static emscripten::val quick_wrap(int b, const std::vector<double>& ave, const std::vector<std::vector<double> >& store) {
        if (b < 0) {
            if (store.size() > 1) {
                return emscripten::val(emscripten::typed_memory_view(ave.size(), ave.data()));
            } else {
                b = 0;
            }
        }
        const auto& val = store[b];
        return emscripten::val(emscripten::typed_memory_view(val.size(), val.data()));
    }
    /**
     * @endcond
     */

    /** 
     * @param b Block of interest.
     * If negative, the average across all blocks is returned.
     *  
     * @return A `Float64Array` view containing the mean log-expression for each gene in block `b`, or the average of the means across blocks if `b < 0`.
     */
    emscripten::val means(int b=0) const {
        return quick_wrap(b, average_means, store.means);
    }

    /** 
     * @param b Block of interest.
     * If negative, the average across all blocks is returned.
     *
     * @return A `Float64Array` view containing the variance of the log-expression for each gene in block `b`, or the average variance across blocks if `b < 0`.
     */
    emscripten::val variances(int b=0) const {
        return quick_wrap(b, average_variances, store.variances);
    }

    /** 
     * @param b Block of interest.
     * If negative, the average across all blocks is returned.
     *
     * @return A `Float64Array` view containing the fitted value of the trend for each gene in block `b`, or the average fitted value across blocks if `b < 0`.
     */
    emscripten::val fitted(int b=0) const {
        return quick_wrap(b, average_fitted, store.fitted);
    }

    /** 
     * @param b Block of interest.
     * If negative, the average across all blocks is returned.
     *
     * @return A `Float64Array` view containing the residual from the trend for each gene in block `b`, or the average residual across blocks if `b < 0`.
     */
    emscripten::val residuals(int b=0) const {
        return quick_wrap(b, average_residuals, store.residuals);
    }

    /**
     * @return Number of blocks used during the calculations.
     */
    int num_blocks () const {
        return store.means.size();
    }
};

/**
 * Model the variance of the log-expression values for each gene, accounting for the mean-variance trend.
 *
 * @param mat An input log-expression matrix containing features in rows and cells in columns.
 * @param use_blocks Whether or not to compute the statistics within each block.
 * If `false`, the number of blocks is assumed to be 1, otherwise it is determined from the maximum value of `blocks`.
 * @param blocks If `use_blocks = true`, offset to an array of `int32_t`s with `ncells` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 * If `use_blocks = false`, this value is ignored.
 * @param span The span of the LOWESS smoother for fitting the mean-variance trend.
 *
 * @return A `ModelGeneVar_Results` object containing the variance modelling statistics.
 */
ModelGeneVar_Results model_gene_var(const NumericMatrix& mat, bool use_blocks, uintptr_t blocks, double span, int nthreads) {
    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    scran::ModelGeneVar var;
    var.set_span(span).set_num_threads(nthreads);
    auto store = var.run_blocked(mat.ptr.get(), bptr);
    return ModelGeneVar_Results(std::move(store));
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(model_gene_var) {
    emscripten::function("model_gene_var", &model_gene_var);

    emscripten::class_<ModelGeneVar_Results>("ModelGeneVar_Results")
        .constructor<int, int>()
        .function("means", &ModelGeneVar_Results::means)
        .function("variances", &ModelGeneVar_Results::variances)
        .function("fitted", &ModelGeneVar_Results::fitted)
        .function("residuals", &ModelGeneVar_Results::residuals)
        .function("num_blocks", &ModelGeneVar_Results::num_blocks)
        ;
}
/**
 * @endcond 
 */

