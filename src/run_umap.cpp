#include <emscripten/bind.h>

#include "utils.h"
#include "NeighborIndex.h"

#include "umappp/umappp.hpp"
#include "knncolle/knncolle.hpp"

#include <chrono>

struct UmapStatus {
    typedef umappp::Status<int, double> Status;

    Status status;

public:
    UmapStatus(Status s) : status(std::move(s)) {}

public:
    int epoch() const {
        return status.epoch();
    }

    int num_epochs() const {
        return status.num_epochs();
    }

    UmapStatus deepcopy(uintptr_t Y) const {
        auto copy = status;
        copy.set_embedding(reinterpret_cast<double*>(Y), false);
        return UmapStatus(std::move(copy));
    }

    int num_observations() const {
        return status.num_observations();
    }
};

UmapStatus initialize_umap(const NeighborResults& neighbors, int num_epochs, double min_dist, uintptr_t Y, int nthreads) {
    umappp::Options opt;
    opt.min_dist = min_dist;
    opt.num_epochs = num_epochs;
    opt.num_threads = nthreads;
    double* embedding = reinterpret_cast<double*>(Y);
    auto stat = umappp::initialize(neighbors.neighbors, 2, embedding, opt);
    return UmapStatus(std::move(stat));
}

void run_umap(UmapStatus& status, int runtime) {
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

    emscripten::class_<UmapStatus>("UmapStatus")
        .function("epoch", &UmapStatus::epoch, emscripten::return_value_policy::take_ownership())
        .function("num_epochs", &UmapStatus::num_epochs, emscripten::return_value_policy::take_ownership())
        .function("num_observations", &UmapStatus::num_observations, emscripten::return_value_policy::take_ownership())
        .function("deepcopy", &UmapStatus::deepcopy, emscripten::return_value_policy::take_ownership());
}
