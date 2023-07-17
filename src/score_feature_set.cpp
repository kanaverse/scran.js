#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/aggregation/ScoreFeatureSet.hpp"

struct ScoreFeatureSet_Results {
    typedef scran::ScoreFeatureSet::Results Store;

    ScoreFeatureSet_Results(Store s) : store(std::move(s)) {}

    Store store;

    emscripten::val weights() const {
        const auto& current = store.weights;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val scores() const {
        const auto& current = store.scores;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

ScoreFeatureSet_Results score_feature_set(const NumericMatrix& mat, uintptr_t features, bool use_blocks, uintptr_t blocks, bool scale, int nthreads) {
    scran::ScoreFeatureSet scorer;
    scorer.set_num_threads(nthreads);
    scorer.set_scale(scale);

    const uint8_t* fptr = reinterpret_cast<const uint8_t*>(features);
    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    auto output = scorer.run_blocked(mat.ptr.get(), fptr, bptr);
    return ScoreFeatureSet_Results(std::move(output));
}

EMSCRIPTEN_BINDINGS(score_feature_set) {
    emscripten::function("score_feature_set", &score_feature_set);

    emscripten::class_<ScoreFeatureSet_Results>("ScoreFeatureSet_Results")
        .function("weights", &ScoreFeatureSet_Results::weights)
        .function("scores", &ScoreFeatureSet_Results::scores)
        ;
}

