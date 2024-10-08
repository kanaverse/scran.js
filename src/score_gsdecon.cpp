#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "gsdecon/gsdecon.hpp"

#include <vector>
#include <string>

struct GsdeconResults {
    typedef gsdecon::Results<double> Store;

    Store store;

public:
    GsdeconResults(Store s) : store(std::move(s)) {}

public:
    emscripten::val weights() const {
        const auto& current = store.weights;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val scores() const {
        const auto& current = store.scores;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

GsdeconResults score_gsdecon(const NumericMatrix& mat, uintptr_t subset, bool use_blocks, uintptr_t blocks, bool scale, std::string weight_policy, int nthreads) {
    int NR = mat.ptr->nrow();
    auto subptr = reinterpret_cast<const uint8_t*>(subset);
    std::vector<int> keep;
    for (int r = 0; r < NR; ++r) {
        if (subptr[r]) {
            keep.push_back(r);
        }
    }
    auto ptr = tatami::make_DelayedSubset(mat.ptr, std::move(keep), true);

    gsdecon::Options opt;
    opt.scale = scale;
    opt.num_threads = nthreads;
    opt.block_weight_policy = translate_block_weight_policy(weight_policy);

    if (use_blocks) {
        auto store = gsdecon::compute_blocked(*ptr, reinterpret_cast<const int32_t*>(blocks), opt);
        return GsdeconResults(std::move(store));
    } else {
        auto store = gsdecon::compute(*ptr, opt);
        return GsdeconResults(std::move(store));
    }
}

EMSCRIPTEN_BINDINGS(score_gsdecon) {
    emscripten::function("score_gsdecon", &score_gsdecon, emscripten::return_value_policy::take_ownership());

    emscripten::class_<GsdeconResults>("GsdeconResults")
        .function("weights", &GsdeconResults::weights, emscripten::return_value_policy::take_ownership())
        .function("scores", &GsdeconResults::scores, emscripten::return_value_policy::take_ownership())
        ;
}

