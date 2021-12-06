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

/**
 * @file run_umap.cpp
 *
 * @brief Visualize cells with UMAP.
 */

/**
 * @brief Status of the UMAP algorithm.
 *
 * This is a wrapper around the similarly named `Status` object from the [**umappp**](https://github.com/LTLA/umappp) library.
 * The general idea is to create this object via `initialize_umap()` before repeatedly calling `run_umap()` to obtain updates.
 */
struct UmapStatus {
    /**
     * @cond
     */
    UmapStatus(umappp::Umap<>::Status s) : status(std::move(s)) {}

    umappp::Umap<>::Status status;
    /**
     * @endcond
     */

    /**
     * @return Number of epochs run so far.
     */
    int epoch() const {
        return status.epoch();
    }

    /**
     * @return Total number of epochs to run.
     */
    int num_epochs() const {
        return status.num_epochs();
    }
};

/**
 * Initialize the UMAP from some nearest neighbor results.
 *
 * @param neighbors Precomputed nearest-neighbor results, usually from `find_nearest_neighbors()`.
 * @param num_epochs Maximum number of epochs to compute.
 * Larger values improve the likelihood of convergence.
 * @param min_dist Minimum distance between neighboring points in the output embedding.
 * Larger values generate a more even distribution of points.
 * @param[out] Y Offset to a 2-by-`nc` array containing the initial coordinates.
 * Each row corresponds to a dimension, each column corresponds to a cell, and the matrix is in column-major format.
 * This is filled with the first two rows of `mat`, i.e., the first and second PCs.
 *
 * @return A `UmapStatus` object that can be passed to `run_umap()` to update `Y`.
 */
UmapStatus initialize_umap_from_neighbors(const NeighborResults& neighbors, int num_epochs, double min_dist, uintptr_t Y) {
    umappp::Umap factory;
    factory.set_min_dist(min_dist).set_num_epochs(num_epochs);
    double* embedding = reinterpret_cast<double*>(Y);

    // Don't move from neighbors; this means that we can easily re-use the
    // existing neighbors if someone wants to change the number of epochs.
    return UmapStatus(factory.initialize(neighbors.neighbors, 2, embedding));
}

/**
 * Initialize the UMAP from a prebuilt neighbor index.
 *
 * @param index Pre-build neighbor search index, `build_neighbor_index()`.
 * @param num_epochs Maximum number of epochs to compute.
 * Larger values improve the likelihood of convergence.
 * @param min_dist Minimum distance between neighboring points in the output embedding.
 * Larger values generate a more even distribution of points.
 * @param[out] Y Offset to a 2-by-`nc` array containing the initial coordinates.
 * Each row corresponds to a dimension, each column corresponds to a cell, and the matrix is in column-major format.
 * This is filled with the first two rows of `mat`, i.e., the first and second PCs.
 *
 * @return A `UmapStatus` object that can be passed to `run_umap()` to update `Y`.
 */
UmapStatus initialize_umap_from_index(const NeighborIndex& index, int num_epochs, double min_dist, uintptr_t Y) {
    auto neighbors = find_nearest_neighbors(index, num_neighbors);
    umappp::Umap factory;
    factory.set_min_dist(min_dist).set_num_epochs(num_epochs);
    double* embedding = reinterpret_cast<double*>(Y);
    return UmapStatus(factory.initialize(std::move(neighbors.neighbors), 2, embedding));
}

/**
 * Initialize the UMAP on an input matrix, usually containing principal components for all cells.
 *
 * @param[in] mat An offset to a 2D array with dimensions (e.g., principal components) in rows and cells in columns.
 * @param nr Number of rows in `mat`.
 * @param nc Number of columns in `mat`.
 * @param num_neighbors Number of neighbors to use to construct the fuzzy sets.
 * Larger values focus on global structure more than the local structure.
 * @param num_epochs Maximum number of epochs to compute.
 * Larger values improve the likelihood of convergence.
 * @param min_dist Minimum distance between neighboring points in the output embedding.
 * Larger values generate a more even distribution of points.
 * @param approximate Whether to use an approximate neighbor search.
 * @param[out] Y Offset to a 2-by-`nc` array containing the initial coordinates.
 * Each row corresponds to a dimension, each column corresponds to a cell, and the matrix is in column-major format.
 * This is filled with the first two rows of `mat`, i.e., the first and second PCs.
 *
 * @return A `UmapStatus` object that can be passed to `run_umap()` to update `Y`.
 */
UmapStatus initialize_umap(uintptr_t mat, int nr, int nc, int num_neighbors, int num_epochs, double min_dist, bool approximate, uintptr_t Y) {
    auto index = build_neighbor_index(mat, nr, nc, approximate);
    return initialize_umap_from_index(index, num_epochs, min_dist, Y);
 }

/**
 * Initialize the UMAP on an input matrix, usually containing principal components for all cells.
 *
 * @param status A `UmapStatus` object created by `initialize_status()`.
 * @param runtime Number of milliseconds to run before returning. 
 * Iterations are performed until the specified `runtime` is exceeded.
 * @param[in, out] Y Offset to a two-dimensional array containing the initial coordinates.
 * Each row corresponds to a dimension, each column corresponds to a cell, and the matrix is in column-major format.
 * On output, this will be filled with the updated coordinates.
 *
 * @return `Y` and `UmapStatus` are updated with the latest results.
 */
void run_umap(UmapStatus& status, int runtime, uintptr_t Y) {
    umappp::Umap factory;
    double* ptr = reinterpret_cast<double*>(Y);
    int current = status.epoch();
    const int total = status.num_epochs();
    auto end = std::chrono::steady_clock::now() + std::chrono::milliseconds(runtime);
    do {
        ++current;
        factory.run(status.status, 2, ptr, current);
    } while (current < total && std::chrono::steady_clock::now() < end);

    return;
}
    
/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(run_umap) {
    emscripten::function("initialize_umap_from_neighbors", &initialize_umap_from_index);

    emscripten::function("initialize_umap_from_index", &initialize_umap_from_index);

    emscripten::function("initialize_umap", &initialize_umap);

    emscripten::function("run_umap", &run_umap);

    emscripten::class_<UmapStatus>("UmapStatus")
        .function("epoch", &UmapStatus::epoch)
        ;
    
}
/**
 * @endcond
 */

