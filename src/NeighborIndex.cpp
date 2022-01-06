#include <emscripten/bind.h>

#include "knncolle/knncolle.hpp"
#include "NeighborIndex.h"
#include "parallel.h"

/**
 * @param[in] mat An offset to a 2D array with dimensions (e.g., principal components) in rows and cells in columns.
 * @param nr Number of rows in `mat`.
 * @param nc Number of columns in `mat`.
 * @param approximate Whether to use an approximate neighbor search.
 *
 * @return A `NeighborIndex` object that can be passed to functions needing to perform a nearest-neighbor search.
 */
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

/**
 * @param index Prebuilt nearest neighbor search index.
 * @param k Number of nearest neighbors to identify.
 *
 * @return A `NeighborResults` containing the search results for each cell.
 */
NeighborResults find_nearest_neighbors(const NeighborIndex& index, int k) {
    size_t nc = index.search->nobs();
    NeighborResults output(nc);
    const auto& search = index.search;
    auto& x = output.neighbors;

#ifdef __EMSCRIPTEN_PTHREADS__
    run_parallel(nc, [&](int left, int right) -> void {
        for (int i = left; i < right; ++i) {
            x[i] = search->find_nearest_neighbors(i, k);
        }
    });
#else
    for (size_t i = 0; i < nc; ++i) {
        x[i] = search->find_nearest_neighbors(i, k);
    }
#endif
    return output;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(build_neighbor_index) {
    emscripten::function("find_nearest_neighbors", &find_nearest_neighbors);

    emscripten::function("build_neighbor_index", &build_neighbor_index);

    emscripten::class_<NeighborIndex>("NeighborIndex")
        .function("num_obs", &NeighborIndex::num_obs);
    
    emscripten::class_<NeighborResults>("NeighborResults")
        .constructor<size_t, uintptr_t, uintptr_t, uintptr_t>()
        .function("num_obs", &NeighborResults::num_obs)
        .function("size", &NeighborResults::size)
        .function("serialize", &NeighborResults::serialize);
}
/**
 * @endcond
 */
