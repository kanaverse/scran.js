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

struct InitializedUmapStatus {
    typedef umappp::Umap<>::Status Status;

    InitializedUmapStatus(Status s) : status(std::move(s)) {}

    Status status;

public:
    int epoch() const {
        return status.epoch();
    }

    int num_epochs() const {
        return status.num_epochs();
    }

    InitializedUmapStatus deepcopy(uintptr_t Y) const {
        auto copy = status;
        copy.set_embedding(reinterpret_cast<double*>(Y), false);
        return InitializedUmapStatus(std::move(copy));
    }

    int num_obs() const {
        return status.nobs();
    }
};

InitializedUmapStatus initialize_umap(const NeighborResults& neighbors, int num_epochs, double min_dist, uintptr_t Y, int nthreads) {
    umappp::Umap factory;
    factory.set_min_dist(min_dist).set_num_epochs(num_epochs).set_num_threads(nthreads);
    double* embedding = reinterpret_cast<double*>(Y);

    // Don't move from neighbors; this means that we can easily re-use the
    // existing neighbors if someone wants to change the number of epochs.
    return InitializedUmapStatus(factory.initialize(neighbors.neighbors, 2, embedding));
}

void run_umap(InitializedUmapStatus& status, int runtime) {
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
    emscripten::function("initialize_umap", &initialize_umap, emscripten::return_value_policy::take_ownership());

    emscripten::function("run_umap", &run_umap, emscripten::return_value_policy::take_ownership());

    emscripten::class_<InitializedUmapStatus>("InitializedUmapStatus")
        .function("epoch", &InitializedUmapStatus::epoch, emscripten::return_value_policy::take_ownership())
        .function("num_epochs", &InitializedUmapStatus::num_epochs, emscripten::return_value_policy::take_ownership())
        .function("num_obs", &InitializedUmapStatus::num_obs, emscripten::return_value_policy::take_ownership())
        .function("deepcopy", &InitializedUmapStatus::deepcopy, emscripten::return_value_policy::take_ownership());
}
