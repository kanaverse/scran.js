#include <emscripten/bind.h>

#include "utils.h"
#include "NeighborIndex.h"

#include "umappp/umappp.hpp"
#include "knncolle/knncolle.hpp"

#include <chrono>

class UmapStatus {
private:
    typedef umappp::Status<std::int32_t, float> Status;

    Status my_status;

public:
    UmapStatus(Status s) : my_status(std::move(s)) {}

    Status& status() {
        return my_status;
    }

public:
    JsFakeInt epoch() const {
        return int2js(my_status.epoch());
    }

    JsFakeInt num_epochs() const {
        return int2js(my_status.num_epochs());
    }

    UmapStatus deepcopy() const {
        return UmapStatus(my_status);
    }

    JsFakeInt num_observations() const {
        return int2js(my_status.num_observations());
    }
};

UmapStatus initialize_umap(
    const NeighborResults& neighbors,
    JsFakeInt num_epochs_raw,
    double min_dist,
    JsFakeInt Y_raw,
    JsFakeInt nthreads_raw
) {
    umappp::Options opt;
    opt.min_dist = min_dist;
    opt.num_epochs = js2int<int>(num_epochs_raw);
    opt.num_threads = js2int<int>(nthreads_raw);

    const auto& in_neighbors = neighbors.neighbors(); 
    const auto nobs = in_neighbors.size();
    auto copy = sanisizer::create<std::vector<std::vector<std::pair<std::int32_t, float> > > >(nobs);
    for (I<decltype(nobs)> i = 0; i < nobs; ++i) {
        auto& output = copy[i];
        const auto& src = in_neighbors[i];
        const auto n = src.size();
        output.reserve(n);
        for (I<decltype(n)> j = 0; j < n; ++j) {
            output.emplace_back(src[j].first, src[j].second);
        }
    }

    const auto Y = js2int<std::uintptr_t>(Y_raw);
    float* embedding = reinterpret_cast<float*>(Y);
    auto stat = umappp::initialize(std::move(copy), 2, embedding, opt);
    return UmapStatus(std::move(stat));
}

void run_umap(UmapStatus& obj, JsFakeInt Y_raw, JsFakeInt runtime_raw) {
    const auto runtime = js2int<std::uint64_t>(runtime_raw); 
    const auto Y = js2int<std::uintptr_t>(Y_raw);
    float* embedding = reinterpret_cast<float*>(Y);
    auto& status = obj.status();

    if (runtime <= 0) {
        status.run(embedding);
    } else {
        auto current = status.epoch();
        const auto total = status.num_epochs();
        const auto end = std::chrono::steady_clock::now() + std::chrono::milliseconds(runtime);
        do {
            ++current;
            status.run(embedding, current);
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
