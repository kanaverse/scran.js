#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "irlba/irlba.hpp"

#include "tatami/stats/variances.hpp"

#include "Eigen/Sparse"

#include <vector>
#include <cmath>

/**
 * Perform a principal components analysis to obtain per-cell coordinates in low-dimensional space.
 *
 * @param mat The input log-expression matrix, with features in rows and cells in columns.
 * @param number Number of PCs to obtain.
 * @param scale Whether to standardize rows in `mat` to unit variance.
 * @param pcs Offset to an output array of `double`s of length `number * mat.ncol()`.
 * @param prop_var Offset to an output array of `double`s of length `number`.
 *
 * @return `pcs` is filled with the PC coordinates in a column-major manner.
 * `prop_var` is filled with the percentage of variance explained by each successive PC.
 */
void run_pca(const NumericMatrix& mat, int number, bool scale, uintptr_t pcs, uintptr_t prop_var) {
    const auto& ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();
    assert(NR > 1);
    assert(NC > 1);
    assert(NR > number);
    assert(NC > number);

    // Filling up the vector of triplets. We pre-allocate at an assumed 10%
    // density, so as to avoid unnecessary movements.
    typedef Eigen::Triplet<double> T;
    std::vector<T> triplets;
    Eigen::VectorXd center_v(NR), scale_v(NR);
    triplets.reserve(static_cast<double>(NR * NC) * 0.1);
    double total_var = 0;

    if (ptr->prefer_rows()) {
        std::vector<double> xbuffer(NC);
        std::vector<int> ibuffer(NC);

        for (size_t r = 0; r < NR; ++r) {
            auto range = ptr->sparse_row(r, xbuffer.data(), ibuffer.data());

            auto stats = tatami::stats::VarianceHelper::compute_with_mean(range, NC);
            center_v[r] = stats.first;
            total_var += stats.second;
            if (scale) {
                scale_v[r] = std::sqrt(stats.second);
            } else {
                scale_v[r] = 1;
            }

            for (size_t i = 0; i < range.number; ++i) {
                triplets.push_back(T(range.index[i], r, range.value[i])); // transposing.
            }
        }

    } else {
        std::vector<double> xbuffer(NR);
        std::vector<int> ibuffer(NR);
        
        tatami::stats::VarianceHelper::Sparse running(NR);
        for (size_t c = 0; c < NC; ++c) {
            auto range = ptr->sparse_column(c, xbuffer.data(), ibuffer.data());
            running.add(range);
            for (size_t i = 0; i < range.number; ++i) {
                triplets.push_back(T(c, range.index[i], range.value[i])); // transposing.
            }
        }

        running.finish();
        std::copy(running.means().begin(), running.means().end(), center_v.begin());
        total_var = std::accumulate(running.statistics().begin(), running.statistics().end(), 0.0);

        if (scale) {
            std::copy(running.statistics().begin(), running.statistics().end(), scale_v.begin());
            for (auto& s : scale_v) { s = std::sqrt(s); }
        } else {
            std::fill(scale_v.begin(), scale_v.end(), 1);
        }
    }

    Eigen::SparseMatrix<double> A(NC, NR); // transposing.
    A.setFromTriplets(triplets.begin(), triplets.end());

    // Running the irlba step.
    irlba::Irlba irb;
    irlba::NormalSampler norm(42);
    auto result = irb.set_number(number).run(A, center_v, scale_v, norm);
    
    // Copying over results into the output arrays.
    double* output = reinterpret_cast<double*>(pcs);
    for (int i = 0; i < number; ++i) {
        for (size_t j = 0; j < NC; ++j, ++output) {
            (*output) = result.U.coeff(j, i) * result.D[i];
        }
    }

    double* output_prop = reinterpret_cast<double*>(prop_var);
    for (int i = 0; i < number; ++i) {
        output_prop[i] = result.D[i] * result.D[i] / static_cast<double>(NC - 1) / total_var;
    }

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

