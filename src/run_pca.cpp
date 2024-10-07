#include <emscripten/bind.h>

#include <vector>
#include <cmath>
#include <algorithm>

#include "NumericMatrix.h"
#include "utils.h"

#include "Eigen/Dense"
#include "scran_pca/scran_pca.hpp"

struct PcaResults {
    bool use_blocked = true;
    scran_pca::SimplePcaResults<Eigen::MatrixXd, Eigen::VectorXd> store_unblocked;
    scran_pca::BlockedPcaResults<Eigen::MatrixXd, Eigen::VectorXd> store_blocked;

public:
    PcaResults(scran_pca::SimplePcaResults<Eigen::MatrixXd, Eigen::VectorXd> store) : store_unblocked(std::move(store)), use_blocked(false) {}

    PcaResults(scran_pca::BlockedPcaResults<Eigen::MatrixXd, Eigen::VectorXd> store) : store_blocked(std::move(store)) {}


private:
    static emscripten::val format_matrix(const Eigen::MatrixXd& mat) {
        size_t len = static_cast<size_t>(mat.rows()) * static_cast<size_t>(mat.cols());
        return emscripten::val(emscripten::typed_memory_view(len, mat.data()));
    };

    static emscripten::val format_vector(const Eigen::MatrixXd& vec) {
        return emscripten::val(emscripten::typed_memory_view(vec.size(), vec.data()));
    };

public:
    emscripten::val components() const {
        if (use_blocked) {
            return format_matrix(store_blocked.components);
        } else {
            return format_matrix(store_unblocked.components);
        }
    }

    emscripten::val variance_explained() const {
        if (use_blocked) {
            return format_vector(store_blocked.variance_explained);
        } else {
            return format_vector(store_unblocked.variance_explained);
        }
    }

    double total_variance() const {
        if (use_blocked) {
            return store_blocked.total_variance;
        } else {
            return store_unblocked.total_variance;
        }
    }

    emscripten::val rotation() const {
        if (use_blocked) {
            return format_matrix(store_blocked.rotation);
        } else {
            return format_matrix(store_unblocked.rotation);
        }
    }

public:
    int num_cells() const {
        if (use_blocked) {
            return store_blocked.components.cols();
        } else {
            return store_unblocked.components.cols();
        }
    }

    int num_pcs() const {
        if (use_blocked) {
            return store_blocked.variance_explained.size();
        } else {
            return store_unblocked.variance_explained.size();
        }
    }
};

PcaResults run_pca(
    const NumericMatrix& mat,
    int number,
    bool use_subset,
    uintptr_t subset,
    bool scale,
    bool use_blocks,
    uintptr_t blocks, 
    std::string weight_policy,
    bool components_from_residuals,
    bool realize_matrix,
    int nthreads) 
{
    if (number < 1) {
        throw std::runtime_error("requested number of PCs should be positive");
    }

    auto ptr = mat.ptr;
    auto NC = ptr->ncol();
    if (NC < number) {
        throw std::runtime_error("fewer cells than the requested number of PCs");
    }

    int NR = ptr->nrow();
    if (use_subset) {
        auto subptr = reinterpret_cast<const uint8_t*>(subset);
        std::vector<int> keep;
        for (int r = 0; r < NR; ++r) {
            if (subptr[r]) {
                keep.push_back(r);
            }
        }
        auto tmp = tatami::make_DelayedSubset(std::move(ptr), std::move(keep), true);
        ptr = std::move(tmp);
    }

    if (use_blocks) {
        scran_pca::BlockedPcaOptions opt;
        opt.number = number;
        opt.scale = scale;
        opt.realize_matrix = realize_matrix;
        opt.num_threads = nthreads;
        opt.block_weight_policy = translate_block_weight_policy(weight_policy);
        opt.components_from_residuals = components_from_residuals;

        auto store = scran_pca::blocked_pca(*ptr, reinterpret_cast<const int32_t*>(blocks), opt);
        return PcaResults(std::move(store));

    } else {
        scran_pca::SimplePcaOptions opt;
        opt.number = number;
        opt.scale = scale;
        opt.realize_matrix = realize_matrix;
        opt.num_threads = nthreads;

        auto store = scran_pca::simple_pca(*ptr, opt);
        return PcaResults(std::move(store));
    }
}

EMSCRIPTEN_BINDINGS(run_pca) {
    emscripten::function("run_pca", &run_pca, emscripten::return_value_policy::take_ownership());

    emscripten::class_<PcaResults>("PcaResults")
        .function("components", &PcaResults::components, emscripten::return_value_policy::take_ownership())
        .function("variance_explained", &PcaResults::variance_explained, emscripten::return_value_policy::take_ownership())
        .function("total_variance", &PcaResults::total_variance, emscripten::return_value_policy::take_ownership())
        .function("rotation", &PcaResults::rotation, emscripten::return_value_policy::take_ownership())
        .function("num_cells", &PcaResults::num_cells, emscripten::return_value_policy::take_ownership())
        .function("num_pcs", &PcaResults::num_pcs, emscripten::return_value_policy::take_ownership())
        ;
}
