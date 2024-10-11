#include <emscripten/bind.h>

#include "utils.h"
#include "NeighborIndex.h"
#include "qdtsne/qdtsne.hpp"

#include <chrono>

struct TsneStatus {
    typedef qdtsne::Status<2, int32_t, double> Status;

    Status status;

public:
    TsneStatus(Status s) : status(std::move(s)) {}

public:
    int32_t iterations () const {
        return status.iteration();
    }

    TsneStatus deepcopy() const {
        return TsneStatus(status);
    }

    int32_t num_observations() const {
        return status.num_observations();
    }
};

TsneStatus initialize_tsne(const NeighborResults& neighbors, double perplexity, int32_t nthreads) {
    qdtsne::Options opt;
    opt.perplexity = perplexity;
    opt.num_threads = nthreads;
    opt.max_depth = 7; // speed up iterations, avoid problems with duplicates.
    auto stat = qdtsne::initialize<2>(neighbors.neighbors, opt);
    return TsneStatus(std::move(stat));
}

void randomize_tsne_start(size_t n, uintptr_t Y, int32_t seed) {
    qdtsne::initialize_random<2>(reinterpret_cast<double*>(Y), n, seed);
    return;
}

int32_t perplexity_to_k(double perplexity) {
    return qdtsne::perplexity_to_k(perplexity);
}

void run_tsne(TsneStatus& status, int32_t runtime, int32_t maxiter, uintptr_t Y) {
    double* ptr = reinterpret_cast<double*>(Y);
    int32_t iter = status.iterations();

    if (runtime <= 0) {
        status.status.run(ptr, maxiter);
    } else {
        auto end = std::chrono::steady_clock::now() + std::chrono::milliseconds(runtime);
        do {
            ++iter;
            status.status.run(ptr, iter);
        } while (iter < maxiter && std::chrono::steady_clock::now() < end);
    }
}

EMSCRIPTEN_BINDINGS(run_tsne) {
    emscripten::function("perplexity_to_k", &perplexity_to_k, emscripten::return_value_policy::take_ownership());

    emscripten::function("initialize_tsne", &initialize_tsne, emscripten::return_value_policy::take_ownership());

    emscripten::function("randomize_tsne_start", &randomize_tsne_start, emscripten::return_value_policy::take_ownership());

    emscripten::function("run_tsne", &run_tsne, emscripten::return_value_policy::take_ownership());

    emscripten::class_<TsneStatus>("TsneStatus")
        .function("iterations", &TsneStatus::iterations, emscripten::return_value_policy::take_ownership())
        .function("deepcopy", &TsneStatus::deepcopy, emscripten::return_value_policy::take_ownership())
        .function("num_observations", &TsneStatus::num_observations, emscripten::return_value_policy::take_ownership());
}
