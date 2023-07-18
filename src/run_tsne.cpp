#include <emscripten/bind.h>

#include "utils.h"
#include "parallel.h"
#include "NeighborIndex.h"
#include "qdtsne/qdtsne.hpp"

#include <vector>
#include <cmath>
#include <chrono>
#include <random>
#include <iostream>

struct TsneStatus {
    typedef qdtsne::Tsne<>::Status<int> Status;

    TsneStatus(Status s) : status(std::move(s)) {}

    Status status;

public:
    int iterations () const {
        return status.iteration();
    }

    TsneStatus deepcopy() const {
        return TsneStatus(status);
    }

    int num_obs() const {
        return status.nobs();
    }
};

TsneStatus initialize_tsne(const NeighborResults& neighbors, double perplexity, int nthreads) {
    qdtsne::Tsne factory;
    factory.set_perplexity(perplexity).set_num_threads(nthreads);
    factory.set_max_depth(7); // speed up iterations, avoid problems with duplicates.
    return TsneStatus(factory.template initialize<>(neighbors.neighbors));
}

void randomize_tsne_start(size_t n, uintptr_t Y, int seed) {
    qdtsne::initialize_random(reinterpret_cast<double*>(Y), n, seed);
    return;
}

int perplexity_to_k(double perplexity) {
    return std::ceil(perplexity * 3);
}

void run_tsne(TsneStatus& status, int runtime, int maxiter, uintptr_t Y) {
    double* ptr = reinterpret_cast<double*>(Y);
    int iter = status.iterations();

    if (runtime <= 0) {
        status.status.run(ptr, maxiter);
    } else {
        auto end = std::chrono::steady_clock::now() + std::chrono::milliseconds(runtime);
        do {
            ++iter;
            status.status.run(ptr, iter);
        } while (iter < maxiter && std::chrono::steady_clock::now() < end);
    }
    return;
}

EMSCRIPTEN_BINDINGS(run_tsne) {
    emscripten::function("perplexity_to_k", &perplexity_to_k);

    emscripten::function("initialize_tsne", &initialize_tsne);

    emscripten::function("randomize_tsne_start", &randomize_tsne_start);

    emscripten::function("run_tsne", &run_tsne);

    emscripten::class_<TsneStatus>("TsneStatus")
        .function("iterations", &TsneStatus::iterations)
        .function("deepcopy", &TsneStatus::deepcopy)
        .function("num_obs", &TsneStatus::num_obs);
}
