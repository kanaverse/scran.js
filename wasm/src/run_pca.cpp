#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "irlba/irlba.hpp"

#include "Eigen/Sparse"

#include <vector>

typedef Eigen::SparseMatrix<double> SpMat; // declares a column-major sparse matrix type of double
typedef Eigen::Triplet<double> T;

void run_pca(const NumericMatrix& mat, int number, uintptr_t pcs) {
    const auto& ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();

    // Filling up the vector of triplets. We pre-allocate at an assumed 10%
    // density, so as to avoid unnecessary movements.
    std::vector<T> triplets;
    triplets.reserve(static_cast<double>(NR * NC) * 0.1);

    if (ptr->prefer_rows()) {
        std::vector<double> xbuffer(NC);
        std::vector<int> ibuffer(NC);
        
        for (size_t r = 0; r < NR; ++r) {
            auto range = ptr->sparse_row(r, xbuffer.data(), ibuffer.data());
            for (size_t i = 0; i < range.number; ++i) {
                triplets.push_back(T(range.index[i], r, range.value[i])); // transposing.
            }
        }
    } else {
        std::vector<double> xbuffer(NR);
        std::vector<int> ibuffer(NR);
        
        for (size_t c = 0; c < NC; ++c) {
            auto range = ptr->sparse_column(c, xbuffer.data(), ibuffer.data());
            for (size_t i = 0; i < range.number; ++i) {
                triplets.push_back(T(c, range.index[i], range.value[i])); // transposing.
            }
        }
    }

    SpMat A(NC, NR); // transposing.
    A.setFromTriplets(triplets.begin(), triplets.end());

    // Running the irlba step.
    // TODO: need to compute means efficiently.
    irlba::Irlba irb;
    irlba::NormalSampler norm(42);
    Eigen::MatrixXd U, V;
    Eigen::VectorXd S;

    irb.set_number(number).run(A, false, false, norm, U, V, S);
    
    // Copying over the U * S into the output array.
    double* output = reinterpret_cast<double*>(pcs);
    for (int i = 0; i < number; ++i) {
        for (size_t j = 0; j < NC; ++j, ++output) {
            (*output) = U.coeff(j, i) * S[i];
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

