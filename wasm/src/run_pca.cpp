#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "irlba/irlba.hpp"

#include "tatami/stats/sums.hpp"
#include "tatami/stats/variances.hpp"

#include "Eigen/Sparse"

#include <vector>
#include <cmath>

typedef Eigen::SparseMatrix<double> SpMat; // declares a column-major sparse matrix type of double
typedef Eigen::Triplet<double> T;

void run_pca(const NumericMatrix& mat, int number, bool scale, uintptr_t pcs) {
    const auto& ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();
    assert(NR > 1);
    assert(NC > 1);
    assert(NR > number);
    assert(NC > number);

    // Filling up the vector of triplets. We pre-allocate at an assumed 10%
    // density, so as to avoid unnecessary movements.
    std::vector<T> triplets;
    Eigen::VectorXd center_v(NR), scale_v(NR);
    triplets.reserve(static_cast<double>(NR * NC) * 0.1);

    if (ptr->prefer_rows()) {
        std::vector<double> xbuffer(NC);
        std::vector<int> ibuffer(NC);

        for (size_t r = 0; r < NR; ++r) {
            auto range = ptr->sparse_row(r, xbuffer.data(), ibuffer.data());

            if (scale) {
                auto stats = tatami::stats::VarianceHelper::compute_with_mean(range, NC);
                center_v[r] = stats.first;
                scale_v[r] = std::sqrt(stats.second);
            } else {
                center_v[r] = tatami::stats::SumHelper::compute(range, NC) / NC;
                scale_v[r] = 1;
            }

            for (size_t i = 0; i < range.number; ++i) {
                triplets.push_back(T(range.index[i], r, range.value[i])); // transposing.
            }
        }

    } else {
        std::vector<double> xbuffer(NR);
        std::vector<int> ibuffer(NR);
        
        if (scale) {
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
            std::copy(running.statistics().begin(), running.statistics().end(), scale_v.begin());
            for (auto& s : scale_v) { s = std::sqrt(s); }

        } else {
            tatami::stats::SumHelper::Sparse running(NR);
            for (size_t c = 0; c < NC; ++c) {
                auto range = ptr->sparse_column(c, xbuffer.data(), ibuffer.data());
                running.add(range);
                for (size_t i = 0; i < range.number; ++i) {
                    triplets.push_back(T(c, range.index[i], range.value[i])); // transposing.
                }
            }

            running.finish();
            std::copy(running.statistics().begin(), running.statistics().end(), center_v.begin());
            for (auto& c : center_v) { c /= NC; }
            std::fill(scale_v.begin(), scale_v.end(), 1);
        }
    }

    SpMat A(NC, NR); // transposing.
    A.setFromTriplets(triplets.begin(), triplets.end());

    // Running the irlba step.
    irlba::Irlba irb;
    irlba::NormalSampler norm(42);
    auto result = irb.set_number(number).run(A, center_v, scale_v, norm);
    
    // Copying over the U * S into the output array.
    double* output = reinterpret_cast<double*>(pcs);
    for (int i = 0; i < number; ++i) {
        for (size_t j = 0; j < NC; ++j, ++output) {
            (*output) = result.U.coeff(j, i) * result.D[i];
        }
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

