#include <emscripten/bind.h>

#include "NeighborIndex.h"
#include "parallel.h"

#include "kmeans/Kmeans.hpp"
#include "kmeans/InitializeRandom.hpp"
#include "kmeans/InitializeKmeansPP.hpp"
#include "kmeans/InitializePCAPartition.hpp"
#include <algorithm>
#include <memory>

/**
 * @file cluster_snn_graph.cpp
 *
 * @brief Identify clusters from a shared nearest-neighbor graph.
 */

/**
 * @brief Javascript-visible wrapper around the result of `scran::BuildSNNGraph::run()`.
 */
struct ClusterKmeans_Result {
    /**
     * @cond
     **/
    kmeans::Kmeans<>::Results store;

    ClusterKmeans_Result(kmeans::Kmeans<>::Results s) : store(std::move(s)) {}
    /**
     * @endcond
     */

    /**
     * @return Number of observations used for clustering.
     */
    size_t num_obs() const {
        return store.clusters.size();
    }

    /**
     * @return Number of clusters.
     */
    size_t num_clusters() const {
        return store.details.sizes.size();
    }

    /**
     * @return A view on an integer array containing the cluster assignment for each observation.
     */
    emscripten::val clusters() const {
        const auto& c = store.clusters;
        return emscripten::val(emscripten::typed_memory_view(c.size(), c.data()));
    }

    /**
     * @return A view on an integer array containing the number of observations assigned to each cluster.
     */
    emscripten::val cluster_sizes() const {
        const auto& s = store.details.sizes;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }

    /**
     * @return A view on a double-precision array containing the within-cluster sum of squares for each cluster.
     */
    emscripten::val wcss() const {
        const auto& s = store.details.withinss;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }

    /**
     * @return Number of iterations used during clustering.
     */
    int iterations() const {
        return store.details.iterations;
    }

    /**
     * @return Algorithm status - anything other than zero usually indicates convergence failure,
     * see [here](https://ltla.github.io/CppKmeans/structkmeans_1_1Details.html) for details.
     */
    int status() const {
        return store.details.status;
    }

    /**
     * @return Column-major array of centers.
     * Number of rows is equal to the number of input dimensions,
     * while the number of columns is equal to the number of clusters.
     */
    emscripten::val centers() const {
        const auto& s = store.centers;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }
};


/**
 * @param[in] mat An offset to a 2D double-precision array with dimensions (e.g., principal components) in rows and cells in columns.
 * @param nr Number of rows in `mat`.
 * @param nc Number of columns in `mat`.
 * Larger values yield more fine-grained clusters.
 * @param k Number of clusters to create.
 * @param init_method Initialization method - random (0), kmeans++ (1) or PCA partitioning (2).
 * @param init_seed Random seed to use for initialization.
 * @param init_pca_adjust Adjustment factor to apply to the cluster sizes prior to the WCSS calculations in PCA partitioning.
 * Values below 1 reduce the preference towards choosing larger clusters for further partitioning.
 *
 * @return A `ClusterKmeans_Result` object containing the... k-means clustering results, obviously.
 */
ClusterKmeans_Result cluster_kmeans(uintptr_t mat, int nr, int nc, int k, int init_method, int init_seed, double init_pca_adjust) {
    const double* ptr = reinterpret_cast<const double*>(mat);

    std::shared_ptr<kmeans::Initialize<> > iptr;
    if (init_method == 0) {
        auto iptr2 = new kmeans::InitializeRandom<>;
        iptr.reset(iptr2);
        iptr2->set_seed(init_seed);

    } else if (init_method == 1) {
        auto iptr2 = new kmeans::InitializeKmeansPP<>;
        iptr.reset(iptr2);
        iptr2->set_seed(init_seed);

    } else {
        auto iptr2 = new kmeans::InitializePCAPartition<>;
        iptr.reset(iptr2);
        iptr2->set_seed(init_seed);
        iptr2->set_size_adjustment(init_pca_adjust);
    }

    kmeans::Kmeans clust;
    auto output = clust.run(nr, nc, ptr, k, iptr.get());

    return ClusterKmeans_Result(std::move(output));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cluster_kmeans) {
    emscripten::function("cluster_kmeans", &cluster_kmeans);

    emscripten::class_<ClusterKmeans_Result>("ClusterKmeans_Result")
        .function("num_obs", &ClusterKmeans_Result::num_obs)
        .function("num_clusters", &ClusterKmeans_Result::num_clusters)
        .function("cluster_sizes", &ClusterKmeans_Result::cluster_sizes)
        .function("wcss", &ClusterKmeans_Result::wcss)
        .function("clusters", &ClusterKmeans_Result::clusters)
        .function("centers", &ClusterKmeans_Result::centers)
        .function("iterations", &ClusterKmeans_Result::iterations)
        .function("status", &ClusterKmeans_Result::status);
}
/**
 * @endcond
 */

