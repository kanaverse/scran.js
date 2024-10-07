#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran_variances/scran_variances.hpp"

#include <vector>
#include <cstdint>

struct ModelGeneVariancesResults {
    bool use_blocked = true;
    scran_variances::ModelGeneVariancesResults<double> store_unblocked;
    scran_variances::ModelGeneVariancesBlockedResults<double> store_blocked;

public:
    ModelGeneVariancesResults(scran_variances::ModelGeneVariancesResults<double> store) : store_unblocked(std::move(store)), use_blocked(false) {}
    ModelGeneVariancesResults(scran_variances::ModelGeneVariancesBlockedResults<double> store) : store_blocked(std::move(store)) {}

private:
    const scran_variances::ModelGeneVariancesResults<double>& choose(int b) const {
        if (use_blocked) {
            if (b < 0) {
                return store_blocked.average;
            } else {
                return store_blocked.per_block[b];
            }
        } else {
            return store_unblocked;
        }
    }

public:
    emscripten::val means(int b) const {
        const auto& chosen = choose(b);
        return emscripten::val(emscripten::typed_memory_view(chosen.means.size(), chosen.means.data()));
    }

    emscripten::val variances(int b) const {
        const auto& chosen = choose(b);
        return emscripten::val(emscripten::typed_memory_view(chosen.variances.size(), chosen.variances.data()));
    }

    emscripten::val fitted(int b) const {
        const auto& chosen = choose(b);
        return emscripten::val(emscripten::typed_memory_view(chosen.fitted.size(), chosen.fitted.data()));
    }

    emscripten::val residuals(int b) const {
        const auto& chosen = choose(b);
        return emscripten::val(emscripten::typed_memory_view(chosen.residuals.size(), chosen.residuals.data()));
    }

public:
    int num_blocks () const {
        if (use_blocked) {
            return store_blocked.per_block.size();
        } else {
            return 1;
        }
    }

    bool is_blocked() const {
        return use_blocked;
    }
};

ModelGeneVariancesResults model_gene_variances(const NumericMatrix& mat, bool use_blocks, uintptr_t blocks, double span, int nthreads) {
    scran_variances::ModelGeneVariancesOptions vopt;
    vopt.fit_variance_trend_options.span = span;
    vopt.num_threads = nthreads;

    if (use_blocks) {
        auto store = scran_variances::model_gene_variances_blocked(*(mat.ptr), reinterpret_cast<const int32_t*>(blocks), vopt);
        return ModelGeneVariancesResults(std::move(store));
    } else {
        auto store = scran_variances::model_gene_variances(*(mat.ptr), vopt);
        return ModelGeneVariancesResults(std::move(store));
    }
}

void choose_highly_variable_genes(int n, uintptr_t statistics, uintptr_t output, int top, double bound) {
    scran_variances::ChooseHighlyVariableGenesOptions copt;
    copt.top = top;
    copt.bound.first = true;
    copt.bound.second = bound;
    scran_variances::choose_highly_variable_genes(n, reinterpret_cast<double*>(statistics), reinterpret_cast<uint8_t*>(output), copt);
}

EMSCRIPTEN_BINDINGS(model_gene_variances) {
    emscripten::function("model_gene_variances", &model_gene_variances, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ModelGeneVariancesResults>("ModelGeneVariancesResults")
        .function("means", &ModelGeneVariancesResults::means, emscripten::return_value_policy::take_ownership())
        .function("variances", &ModelGeneVariancesResults::variances, emscripten::return_value_policy::take_ownership())
        .function("fitted", &ModelGeneVariancesResults::fitted, emscripten::return_value_policy::take_ownership())
        .function("residuals", &ModelGeneVariancesResults::residuals, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &ModelGeneVariancesResults::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("is_blocked", &ModelGeneVariancesResults::is_blocked, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("choose_highly_variable_genes", &choose_highly_variable_genes, emscripten::return_value_policy::take_ownership());
}
