#include <emscripten/bind.h>

#include "NeighborIndex.h"

#include "knncolle/knncolle.hpp"
#include "knncolle_annoy/knncolle_annoy.hpp"

#include <algorithm>

std::unique_ptr<knncolle::Builder<knncolle::SimpleMatrix<int32_t, int32_t, double>, double> > create_builder(bool approximate) {
    std::unique_ptr<knncolle::Builder<knncolle::SimpleMatrix<int32_t, int32_t, double>, double> > builder;
    if (approximate) {
        knncolle_annoy::AnnoyOptions opt;
        builder.reset(new knncolle_annoy::AnnoyBuilder<Annoy::Euclidean>(opt));
    } else {
        builder.reset(new knncolle::VptreeBuilder<knncolle::EuclideanDistance>);
    }
    return builder;
}

NeighborIndex build_neighbor_index(uintptr_t mat, int32_t nr, int32_t nc, bool approximate) {
    auto builder = create_builder(approximate);
    NeighborIndex output;
    const double* ptr = reinterpret_cast<const double*>(mat);
    output.index = builder->build_unique(knncolle::SimpleMatrix<int32_t, int32_t, double>(nr, nc, ptr));
    return output;
}

NeighborResults find_nearest_neighbors(const NeighborIndex& index, int32_t k, int32_t nthreads) {
    NeighborResults output;
    output.neighbors = knncolle::find_nearest_neighbors(*(index.index), k, nthreads);
    return output;
}

NeighborResults truncate_nearest_neighbors(const NeighborResults& original, int32_t k) {
    NeighborResults output;
    size_t nobs = original.neighbors.size();
    output.neighbors.resize(nobs);
    size_t desired = static_cast<size_t>(k);
    for (size_t i = 0; i <nobs; ++i) {
        const auto& current = original.neighbors[i];
        auto& curout = output.neighbors[i];
        size_t size = std::min(current.size(), desired);
        curout.insert(curout.end(), current.begin(), current.begin() + size);
    }
    return output;
}

EMSCRIPTEN_BINDINGS(build_neighbor_index) {
    emscripten::function("find_nearest_neighbors", &find_nearest_neighbors, emscripten::return_value_policy::take_ownership());

    emscripten::function("truncate_nearest_neighbors", &truncate_nearest_neighbors, emscripten::return_value_policy::take_ownership());

    emscripten::function("build_neighbor_index", &build_neighbor_index, emscripten::return_value_policy::take_ownership());

    emscripten::class_<NeighborIndex>("NeighborIndex")
        .function("num_obs", &NeighborIndex::num_obs, emscripten::return_value_policy::take_ownership())
        .function("num_dim", &NeighborIndex::num_dim, emscripten::return_value_policy::take_ownership());
    
    emscripten::class_<NeighborResults>("NeighborResults")
        .constructor<size_t, uintptr_t, uintptr_t, uintptr_t>()
        .function("num_obs", &NeighborResults::num_obs, emscripten::return_value_policy::take_ownership())
        .function("num_neighbors", &NeighborResults::num_neighbors, emscripten::return_value_policy::take_ownership())
        .function("size", &NeighborResults::size, emscripten::return_value_policy::take_ownership())
        .function("serialize", &NeighborResults::serialize, emscripten::return_value_policy::take_ownership());
}
