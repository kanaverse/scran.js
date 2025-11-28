#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran_variances/scran_variances.hpp"

#include <cstdint>
#include <string>

class ModelGeneVariancesResults {
private:
    bool my_use_blocked = true;
    scran_variances::ModelGeneVariancesResults<double> my_store_unblocked;
    scran_variances::ModelGeneVariancesBlockedResults<double> my_store_blocked;

public:
    ModelGeneVariancesResults(scran_variances::ModelGeneVariancesResults<double> store) : my_use_blocked(false), my_store_unblocked(std::move(store)) {}

    ModelGeneVariancesResults(scran_variances::ModelGeneVariancesBlockedResults<double> store) : my_store_blocked(std::move(store)) {}

private:
    const scran_variances::ModelGeneVariancesResults<double>& choose(JsFakeInt b_raw) const {
        if (my_use_blocked) {
            if (b_raw < 0) {
                return my_store_blocked.average;
            } else {
                return my_store_blocked.per_block[js2int<std::size_t>(b_raw)];
            }
        } else {
            return my_store_unblocked;
        }
    }

public:
    emscripten::val js_means(JsFakeInt b_raw) const {
        const auto& chosen = choose(b_raw);
        return emscripten::val(emscripten::typed_memory_view(chosen.means.size(), chosen.means.data()));
    }

    emscripten::val js_variances(JsFakeInt b_raw) const {
        const auto& chosen = choose(b_raw);
        return emscripten::val(emscripten::typed_memory_view(chosen.variances.size(), chosen.variances.data()));
    }

    emscripten::val js_fitted(JsFakeInt b_raw) const {
        const auto& chosen = choose(b_raw);
        return emscripten::val(emscripten::typed_memory_view(chosen.fitted.size(), chosen.fitted.data()));
    }

    emscripten::val js_residuals(JsFakeInt b_raw) const {
        const auto& chosen = choose(b_raw);
        return emscripten::val(emscripten::typed_memory_view(chosen.residuals.size(), chosen.residuals.data()));
    }

public:
    JsFakeInt js_num_blocks() const {
        if (my_use_blocked) {
            return int2js(my_store_blocked.per_block.size());
        } else {
            return 1;
        }
    }

    bool js_is_blocked() const {
        return my_use_blocked;
    }
};

ModelGeneVariancesResults js_model_gene_variances(
    const NumericMatrix& mat,
    bool use_blocks,
    JsFakeInt blocks_raw,
    double span,
    std::string weight_policy,
    JsFakeInt nthreads_raw
) {
    scran_variances::ModelGeneVariancesOptions vopt;
    vopt.fit_variance_trend_options.span = span;
    vopt.block_weight_policy = translate_block_weight_policy(weight_policy);
    vopt.num_threads = js2int<int>(nthreads_raw);

    if (use_blocks) {
        const auto blocks = js2int<std::uintptr_t>(blocks_raw);
        auto store = scran_variances::model_gene_variances_blocked(*(mat.ptr()), reinterpret_cast<const std::int32_t*>(blocks), vopt);
        return ModelGeneVariancesResults(std::move(store));
    } else {
        auto store = scran_variances::model_gene_variances(*(mat.ptr()), vopt);
        return ModelGeneVariancesResults(std::move(store));
    }
}

void js_choose_highly_variable_genes(
    JsFakeInt n_raw,
    JsFakeInt statistics_raw,
    JsFakeInt output_raw,
    JsFakeInt top_raw,
    double bound
) {
    scran_variances::ChooseHighlyVariableGenesOptions copt;
    copt.top = js2int<std::size_t>(top_raw);
    copt.use_bound = true;
    copt.bound = bound;
    scran_variances::choose_highly_variable_genes(
        js2int<std::size_t>(n_raw),
        reinterpret_cast<double*>(js2int<std::uintptr_t>(statistics_raw)),
        reinterpret_cast<std::uint8_t*>(js2int<std::uintptr_t>(output_raw)),
        copt
    );
}

EMSCRIPTEN_BINDINGS(model_gene_variances) {
    emscripten::function("model_gene_variances", &js_model_gene_variances, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ModelGeneVariancesResults>("ModelGeneVariancesResults")
        .function("means", &ModelGeneVariancesResults::js_means, emscripten::return_value_policy::take_ownership())
        .function("variances", &ModelGeneVariancesResults::js_variances, emscripten::return_value_policy::take_ownership())
        .function("fitted", &ModelGeneVariancesResults::js_fitted, emscripten::return_value_policy::take_ownership())
        .function("residuals", &ModelGeneVariancesResults::js_residuals, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &ModelGeneVariancesResults::js_num_blocks, emscripten::return_value_policy::take_ownership())
        .function("is_blocked", &ModelGeneVariancesResults::js_is_blocked, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("choose_highly_variable_genes", &js_choose_highly_variable_genes, emscripten::return_value_policy::take_ownership());
}
