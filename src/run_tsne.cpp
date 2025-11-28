#include <emscripten/bind.h>

#include "utils.h"
#include "NeighborIndex.h"
#include "qdtsne/qdtsne.hpp"

#include <chrono>
#include <cstdint>
#include <cstddef>

class TsneStatus {
private:
    typedef qdtsne::Status<2, std::int32_t, double> Status;

    Status my_status;

public:
    TsneStatus(Status s) : my_status(std::move(s)) {}

    Status& status() {
        return my_status;
    }

public:
    JsFakeInt js_iterations() const {
        return int2js(my_status.iteration());
    }

    TsneStatus js_deepcopy() const {
        return TsneStatus(my_status);
    }

    JsFakeInt js_num_observations() const {
        return int2js(my_status.num_observations());
    }
};

TsneStatus js_initialize_tsne(const NeighborResults& neighbors, double perplexity, JsFakeInt nthreads_raw) {
    qdtsne::Options opt;
    opt.perplexity = perplexity;
    opt.num_threads = js2int<int>(nthreads_raw);
    opt.max_depth = 7; // speed up iterations, avoid problems with duplicates.
    auto stat = qdtsne::initialize<2>(neighbors.neighbors(), opt);
    return TsneStatus(std::move(stat));
}

void js_randomize_tsne_start(JsFakeInt n_raw, JsFakeInt Y_raw, JsFakeInt seed_raw) {
    const auto Y = js2int<std::uintptr_t>(Y_raw);
    qdtsne::initialize_random<2>(
        reinterpret_cast<double*>(Y),
        js2int<std::size_t>(n_raw),
        js2int<std::uint64_t>(seed_raw)
    );
    return;
}

JsFakeInt js_perplexity_to_k(double perplexity) {
    return int2js(qdtsne::perplexity_to_k(perplexity));
}

void js_run_tsne(TsneStatus& obj, JsFakeInt runtime_raw, JsFakeInt maxiter_raw, JsFakeInt Y_raw) {
    auto& status = obj.status();
    const auto Y = js2int<std::uintptr_t>(Y_raw);
    double* ptr = reinterpret_cast<double*>(Y);

    auto iter = status.iteration();
    const auto runtime = js2int<std::uint64_t>(runtime_raw);
    const auto maxiter = js2int<I<decltype(iter)> >(maxiter_raw); 

    if (runtime <= 0) {
        status.run(ptr, maxiter);
    } else {
        auto end = std::chrono::steady_clock::now() + std::chrono::milliseconds(runtime);
        do {
            ++iter;
            status.run(ptr, iter);
        } while (iter < maxiter && std::chrono::steady_clock::now() < end);
    }
}

EMSCRIPTEN_BINDINGS(run_tsne) {
    emscripten::function("perplexity_to_k", &js_perplexity_to_k, emscripten::return_value_policy::take_ownership());

    emscripten::function("initialize_tsne", &js_initialize_tsne, emscripten::return_value_policy::take_ownership());

    emscripten::function("randomize_tsne_start", &js_randomize_tsne_start, emscripten::return_value_policy::take_ownership());

    emscripten::function("run_tsne", &js_run_tsne, emscripten::return_value_policy::take_ownership());

    emscripten::class_<TsneStatus>("TsneStatus")
        .function("iterations", &TsneStatus::js_iterations, emscripten::return_value_policy::take_ownership())
        .function("deepcopy", &TsneStatus::js_deepcopy, emscripten::return_value_policy::take_ownership())
        .function("num_observations", &TsneStatus::js_num_observations, emscripten::return_value_policy::take_ownership())
        ;
}
