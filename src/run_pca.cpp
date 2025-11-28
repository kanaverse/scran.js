#include <emscripten/bind.h>

#include <string>
#include <vector>
#include <stdexcept>

#include "NumericMatrix.h"
#include "utils.h"

#include "Eigen/Dense"
#include "tatami/tatami.hpp"
#include "scran_pca/scran_pca.hpp"

class PcaResults {
    bool my_use_blocked = true;
    scran_pca::SimplePcaResults<Eigen::MatrixXd, Eigen::VectorXd> my_store_unblocked;
    scran_pca::BlockedPcaResults<Eigen::MatrixXd, Eigen::VectorXd> my_store_blocked;

public:
    PcaResults(scran_pca::SimplePcaResults<Eigen::MatrixXd, Eigen::VectorXd> store) : my_use_blocked(false), my_store_unblocked(std::move(store)) {}

    PcaResults(scran_pca::BlockedPcaResults<Eigen::MatrixXd, Eigen::VectorXd> store) : my_store_blocked(std::move(store)) {}

private:
    static emscripten::val format_matrix(const Eigen::MatrixXd& mat) {
        auto len = sanisizer::product_unsafe<std::size_t>(mat.rows(), mat.cols());
        return emscripten::val(emscripten::typed_memory_view(len, mat.data()));
    };

    static emscripten::val format_vector(const Eigen::MatrixXd& vec) {
        return emscripten::val(emscripten::typed_memory_view(vec.size(), vec.data()));
    };

public:
    emscripten::val js_components() const {
        if (my_use_blocked) {
            return format_matrix(my_store_blocked.components);
        } else {
            return format_matrix(my_store_unblocked.components);
        }
    }

    emscripten::val js_variance_explained() const {
        if (my_use_blocked) {
            return format_vector(my_store_blocked.variance_explained);
        } else {
            return format_vector(my_store_unblocked.variance_explained);
        }
    }

    double js_total_variance() const {
        if (my_use_blocked) {
            return my_store_blocked.total_variance;
        } else {
            return my_store_unblocked.total_variance;
        }
    }

    emscripten::val js_rotation() const {
        if (my_use_blocked) {
            return format_matrix(my_store_blocked.rotation);
        } else {
            return format_matrix(my_store_unblocked.rotation);
        }
    }

public:
    JsFakeInt js_num_cells() const {
        if (my_use_blocked) {
            return int2js(my_store_blocked.components.cols());
        } else {
            return int2js(my_store_unblocked.components.cols());
        }
    }

    JsFakeInt js_num_pcs() const {
        if (my_use_blocked) {
            return int2js(my_store_blocked.variance_explained.size());
        } else {
            return int2js(my_store_unblocked.variance_explained.size());
        }
    }
};

PcaResults js_run_pca(
    const NumericMatrix& mat,
    JsFakeInt number_raw,
    bool use_subset,
    JsFakeInt subset_raw,
    bool scale,
    bool use_blocks,
    JsFakeInt blocks_raw, 
    std::string weight_policy,
    bool components_from_residuals,
    bool realize_matrix,
    JsFakeInt nthreads_raw
) {
    const auto number = js2int<int>(number_raw); 
    if (number < 1) {
        throw std::runtime_error("requested number of PCs should be positive");
    }

    auto ptr = mat.ptr();
    const auto NR = ptr->nrow();

    if (use_subset) {
        const auto subset = js2int<std::uintptr_t>(subset_raw);
        auto subptr = reinterpret_cast<const std::uint8_t*>(subset);
        std::vector<int> keep;
        for (I<decltype(NR)> r = 0; r < NR; ++r) {
            if (subptr[r]) {
                keep.push_back(r);
            }
        }
        auto tmp = tatami::make_DelayedSubset(std::move(ptr), std::move(keep), true);
        ptr = std::move(tmp);
    }

    const auto nthreads = js2int<int>(nthreads_raw);

    if (use_blocks) {
        scran_pca::BlockedPcaOptions opt;
        opt.number = number;
        opt.scale = scale;
        opt.realize_matrix = realize_matrix;
        opt.num_threads = nthreads;
        opt.block_weight_policy = translate_block_weight_policy(weight_policy);
        opt.components_from_residuals = components_from_residuals;

        const auto blocks = js2int<std::uintptr_t>(blocks_raw);
        auto store = scran_pca::blocked_pca(*ptr, reinterpret_cast<const std::int32_t*>(blocks), opt);
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
    emscripten::function("run_pca", &js_run_pca, emscripten::return_value_policy::take_ownership());

    emscripten::class_<PcaResults>("PcaResults")
        .function("components", &PcaResults::js_components, emscripten::return_value_policy::take_ownership())
        .function("variance_explained", &PcaResults::js_variance_explained, emscripten::return_value_policy::take_ownership())
        .function("total_variance", &PcaResults::js_total_variance, emscripten::return_value_policy::take_ownership())
        .function("rotation", &PcaResults::js_rotation, emscripten::return_value_policy::take_ownership())
        .function("num_cells", &PcaResults::js_num_cells, emscripten::return_value_policy::take_ownership())
        .function("num_pcs", &PcaResults::js_num_pcs, emscripten::return_value_policy::take_ownership())
        ;
}
