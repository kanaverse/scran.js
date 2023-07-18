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
    typedef umappp::Umap<>::Status Status;

    UmapStatus(Status s) : status(std::move(s)) {}

    Status status;
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

    /**
     * @return A deep copy of this object.
     */
    UmapStatus deepcopy() const {
        return UmapStatus(status);
    }

    /**
     * @return Number of observations in the dataset.
     */
    int num_obs() const {
        return status.nobs();
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
    
/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(run_umap) {
    emscripten::function("initialize_umap", &initialize_umap);

    emscripten::function("run_umap", &run_umap);

    emscripten::class_<UmapStatus>("UmapStatus")
        .function("epoch", &UmapStatus::epoch)
        .function("num_epochs", &UmapStatus::num_epochs)
        .function("num_obs", &UmapStatus::num_obs)
        .function("deepcopy", &UmapStatus::deepcopy);
}
/**
 * @endcond
 */

