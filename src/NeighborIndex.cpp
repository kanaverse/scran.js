#include <emscripten/bind.h>

#include "NeighborIndex.h"
#include "parallel.h"

#include "knncolle/knncolle.hpp"

NeighborIndex build_neighbor_index(uintptr_t mat, int nr, int nc, bool approximate) {
    NeighborIndex output;
    const double* ptr = reinterpret_cast<const double*>(mat);
    if (approximate) {
        output.search.reset(new knncolle::AnnoyEuclidean<>(nr, nc, ptr));
    } else {
        output.search.reset(new knncolle::VpTreeEuclidean<>(nr, nc, ptr));
    }
    return output;
}

NeighborResults find_nearest_neighbors(const NeighborIndex& index, int k, int nthreads) {
    size_t nc = index.search->nobs();
    NeighborResults output(nc);
    const auto& search = index.search;
    auto& x = output.neighbors;

    run_parallel_old(nc, [&](int left, int right) -> void {
        for (int i = left; i < right; ++i) {
            x[i] = search->find_nearest_neighbors(i, k);
        }
    }, nthreads);

    return output;
}

EMSCRIPTEN_BINDINGS(build_neighbor_index) {
    emscripten::function("find_nearest_neighbors", &find_nearest_neighbors, emscripten::return_value_policy::take_ownership());

    emscripten::function("build_neighbor_index", &build_neighbor_index, emscripten::return_value_policy::take_ownership());

    emscripten::class_<NeighborIndex>("NeighborIndex")
        .function("num_obs", &NeighborIndex::num_obs, emscripten::return_value_policy::take_ownership())
        .function("num_dim", &NeighborIndex::num_dim, emscripten::return_value_policy::take_ownership());
    
    emscripten::class_<NeighborResults>("NeighborResults")
        .constructor<size_t, uintptr_t, uintptr_t, uintptr_t>()
        .function("num_obs", &NeighborResults::num_obs, emscripten::return_value_policy::take_ownership())
        .function("size", &NeighborResults::size, emscripten::return_value_policy::take_ownership())
        .function("serialize", &NeighborResults::serialize, emscripten::return_value_policy::take_ownership());
}
