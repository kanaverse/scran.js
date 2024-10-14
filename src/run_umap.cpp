#include <emscripten/bind.h>

#include "utils.h"
#include "NeighborIndex.h"

#include "umappp/umappp.hpp"
#include "knncolle/knncolle.hpp"

#include <chrono>

struct UmapStatus {
    typedef umappp::Status<int32_t, float> Status;

    Status status;

public:
    UmapStatus(Status s) : status(std::move(s)) {}

public:
    int32_t epoch() const {
        return status.epoch();
    }

    int32_t num_epochs() const {
        return status.num_epochs();
    }

    UmapStatus deepcopy(uintptr_t Y) const {
        auto copy = status;
        copy.set_embedding(reinterpret_cast<float*>(Y), false);
        return UmapStatus(std::move(copy));
    }

    int32_t num_observations() const {
        return status.num_observations();
    }
};

UmapStatus initialize_umap(const NeighborResults& neighbors, int32_t num_epochs, double min_dist, uintptr_t Y, int32_t nthreads) {
    umappp::Options opt;
    opt.min_dist = min_dist;
    opt.num_epochs = num_epochs;
    opt.num_threads = nthreads;

    std::vector<std::vector<std::pair<int32_t, float> > > copy(neighbors.neighbors.size());
    for (size_t i = 0, end = copy.size(); i < end; ++i) {
        auto& output = copy[i];
        const auto& src = neighbors.neighbors[i];
        size_t n = src.size();
        output.reserve(n);
        for (size_t j = 0; j < n; ++j) {
            output.emplace_back(src[j].first, src[j].second);
        }
    }

    float* embedding = reinterpret_cast<float*>(Y);
    auto stat = umappp::initialize(std::move(copy), 2, embedding, opt);
    return UmapStatus(std::move(stat));
}

void run_umap(UmapStatus& status, int32_t runtime) {
    if (runtime <= 0) {
        status.status.run();
    } else {
        int32_t current = status.epoch();
        const int32_t total = status.num_epochs();
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
