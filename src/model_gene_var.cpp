#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "parallel.h"
#include "utils.h"

#include "scran/scran.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

struct ModelGeneVar_Results {
    typedef scran::ModelGeneVar::AverageBlockResults Store;

    ModelGeneVar_Results(Store s) : store(std::move(s)) {}

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

ModelGeneVar_Results model_gene_var(const NumericMatrix& mat, bool use_blocks, uintptr_t blocks, double span, int nthreads) {
    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    scran::ModelGeneVar var;
    var.set_span(span).set_num_threads(nthreads);
    auto store = var.run_blocked_with_average(mat.ptr.get(), bptr);
    return ModelGeneVar_Results(std::move(store));
}

EMSCRIPTEN_BINDINGS(model_gene_var) {
    emscripten::function("model_gene_var", &model_gene_var);

    emscripten::class_<ModelGeneVar_Results>("ModelGeneVar_Results")
        .function("means", &ModelGeneVar_Results::means)
        .function("variances", &ModelGeneVar_Results::variances)
        .function("fitted", &ModelGeneVar_Results::fitted)
        .function("residuals", &ModelGeneVar_Results::residuals)
        .function("num_blocks", &ModelGeneVar_Results::num_blocks)
        ;
}
