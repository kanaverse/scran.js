#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "gsdecon/gsdecon.hpp"

#include <vector>
#include <string>

class GsdeconResults {
    typedef gsdecon::Results<double> Store;

    Store my_store;

public:
    GsdeconResults(Store s) : my_store(std::move(s)) {}

public:
    emscripten::val weights() const {
        const auto& current = my_store.weights;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val scores() const {
        const auto& current = my_store.scores;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

GsdeconResults score_gsdecon(
    const NumericMatrix& mat,
    JsFakeInt subset_raw,
    bool use_blocks,
    JsFakeInt blocks_raw,
    bool scale,
    std::string weight_policy,
    JsFakeInt nthreads_raw
) {
    const auto NR = mat.nrow();
    const auto subset = js2int<std::uintptr_t>(subset_raw);
    auto subptr = reinterpret_cast<const std::uint8_t*>(subset);
    std::vector<I<decltype(NR)> > keep;
    for (I<decltype(NR)> r = 0; r < NR; ++r) {
        if (subptr[r]) {
            keep.push_back(r);
        }
    }
    auto ptr = tatami::make_DelayedSubset(mat.ptr(), std::move(keep), true);

    gsdecon::Options opt;
    opt.scale = scale;
    opt.num_threads = js2int<int>(nthreads_raw);
    opt.block_weight_policy = translate_block_weight_policy(weight_policy);

    if (use_blocks) {
        const auto blocks = js2int<std::uintptr_t>(blocks_raw);
        auto store = gsdecon::compute_blocked(*ptr, reinterpret_cast<const std::int32_t*>(blocks), opt);
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

