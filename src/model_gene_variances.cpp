#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "parallel.h"
#include "utils.h"

#include "scran/scran.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

struct ModelGeneVariances_Results {
    typedef scran::ModelGeneVariances::BlockResults Store;

    ModelGeneVariances_Results(Store s) : store(std::move(s)) {}

    Store store;

public:
    emscripten::val means(int b) const {
        if (b < 0) {
            return emscripten::val(emscripten::typed_memory_view(store.average.means.size(), store.average.means.data()));
        } else {
            return emscripten::val(emscripten::typed_memory_view(store.per_block[b].means.size(), store.per_block[b].means.data()));
        }
    }

    emscripten::val variances(int b) const {
        if (b < 0) {
            return emscripten::val(emscripten::typed_memory_view(store.average.variances.size(), store.average.variances.data()));
        } else {
            return emscripten::val(emscripten::typed_memory_view(store.per_block[b].variances.size(), store.per_block[b].variances.data()));
        }
    }

    emscripten::val fitted(int b) const {
        if (b < 0) {
            return emscripten::val(emscripten::typed_memory_view(store.average.fitted.size(), store.average.fitted.data()));
        } else {
            return emscripten::val(emscripten::typed_memory_view(store.per_block[b].fitted.size(), store.per_block[b].fitted.data()));
        }
    }

    emscripten::val residuals(int b) const {
        if (b < 0) {
            return emscripten::val(emscripten::typed_memory_view(store.average.residuals.size(), store.average.residuals.data()));
        } else {
            return emscripten::val(emscripten::typed_memory_view(store.per_block[b].residuals.size(), store.per_block[b].residuals.data()));
        }
    }

    int num_blocks () const {
        return store.per_block.size();
    }
};

ModelGeneVariances_Results model_gene_variances(const NumericMatrix& mat, bool use_blocks, uintptr_t blocks, double span, int nthreads) {
    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    scran::ModelGeneVariances var;
    var.set_span(span).set_num_threads(nthreads);
    auto store = var.run_blocked(mat.ptr.get(), bptr);
    return ModelGeneVariances_Results(std::move(store));
}

EMSCRIPTEN_BINDINGS(model_gene_variances) {
    emscripten::function("model_gene_variances", &model_gene_variances, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ModelGeneVariances_Results>("ModelGeneVariances_Results")
        .function("means", &ModelGeneVariances_Results::means, emscripten::return_value_policy::take_ownership())
        .function("variances", &ModelGeneVariances_Results::variances, emscripten::return_value_policy::take_ownership())
        .function("fitted", &ModelGeneVariances_Results::fitted, emscripten::return_value_policy::take_ownership())
        .function("residuals", &ModelGeneVariances_Results::residuals, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &ModelGeneVariances_Results::num_blocks, emscripten::return_value_policy::take_ownership())
        ;
}
