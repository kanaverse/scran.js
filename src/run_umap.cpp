#include <emscripten/bind.h>

#include "utils.h"
#include "parallel.h"
#include "NeighborIndex.h"

#include "umappp/Umap.hpp"
#include "knncolle/knncolle.hpp"

#include <vector>
#include <cmath>
#include <chrono>
#include <random>
#include <iostream>

struct UmapStatus {
    typedef umappp::Umap<>::Status Status;

    UmapStatus(Status s) : status(std::move(s)) {}

    Status status;

public:
    int epoch() const {
        return status.epoch();
    }

    int num_epochs() const {
        return status.num_epochs();
    }

    UmapStatus deepcopy() const {
        return UmapStatus(status);
    }

    int num_obs() const {
        return status.nobs();
    }
};

UmapStatus initialize_umap(const NeighborResults& neighbors, int num_epochs, double min_dist, uintptr_t Y, int nthreads) {
    umappp::Umap factory;
    factory.set_min_dist(min_dist).set_num_epochs(num_epochs).set_num_threads(nthreads);
    double* embedding = reinterpret_cast<double*>(Y);

    // Don't move from neighbors; this means that we can easily re-use the
    // existing neighbors if someone wants to change the number of epochs.
    return UmapStatus(factory.initialize(neighbors.neighbors, 2, embedding));
}

void run_umap(UmapStatus& status, int runtime, uintptr_t Y) {
    if (runtime <= 0) {
        status.status.run();
    } else {
        int current = status.epoch();
        const int total = status.num_epochs();
        auto end = std::chrono::steady_clock::now() + std::chrono::milliseconds(runtime);
        do {
            ++current;
            status.status.run(current);
        } while (current < total && std::chrono::steady_clock::now() < end);
    }
}

EMSCRIPTEN_BINDINGS(run_umap) {
    emscripten::function("initialize_umap", &initialize_umap);

    emscripten::function("run_umap", &run_umap);

    emscripten::class_<UmapStatus>("UmapStatus")
        .function("epoch", &UmapStatus::epoch)
        .function("num_epochs", &UmapStatus::num_epochs)
        .function("num_obs", &UmapStatus::num_obs)
        .function("deepcopy", &UmapStatus::deepcopy);
}
