#include <emscripten/bind.h>

#include "scran/clustering/ClusterSNNGraph.hpp"
#include <algorithm>

/**
 * @file cluster_snn_graph.cpp
 *
 * @brief Identify clusters from a shared nearest-neighbor graph.
 */

/**
 * @brief Javascript-visible wrapper around `scran::ClusterSNNGraph::MultiLevelResult`.
 */
struct ClusterSNNGraphMultiLevel_Result {
    /**
     * @cond
     */
    typedef scran::ClusterSNNGraphMultiLevel::Results Store;

    ClusterSNNGraphMultiLevel_Result(Store s) : store(std::move(s)) {}

    Store store;
    /**
     * @endcond
     */

    /**
     * @return Number of available levels.
     */
    int number() const {
        return store.membership.size();
    }

    /**
     * @return Index of the level with the highest modularity.
     */
    int best() const {
        return store.max;
    }

    /**
     * @param i Index of the level of interest.
     * @return Modularity of the clustering at that level.
     */
    double modularity(int i) const {
        return store.modularity[i];
    }

    /**
     * @param i Index of the level of interest.
     * @return `Int32Array` view containing the cluster assignment for each cell.
     */
    emscripten::val membership(int i) const {
        const auto& current = store.membership[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

/**
 * @param ndim Number of dimensions.
 * @param ncells Number of cells.
 * @param[in] mat Offset to an array of `double`s containing per-cell coordinates (usually PCs).
 * Array should be column-major where rows are dimensions and columns are cells.
 * @param k Number of neighbors to use to construct the nearest neighbor graph.
 * @param resolution Resolution of the multi-level clustering, used in the modularity calculation.
 * Larger values yield more fine-grained clusters.
 * @param approximate Whether an approximate nearest neighbor search should be performed.
 *
 * @return A `ClusterSNNGraphMultiLevel_Result` object containing the... multi-level clustering results, obviously.
 */
ClusterSNNGraphMultiLevel_Result cluster_snn_graph(int ndim, int ncells, uintptr_t mat, int k, double resolution, bool approximate) {
    scran::ClusterSNNGraphMultiLevel clust;
    clust.set_neighbors(k).set_resolution(resolution).set_approximate(approximate);

    const double* ptr = reinterpret_cast<const double*>(mat);
    auto output = clust.run(ndim, ncells, ptr);
    return ClusterSNNGraphMultiLevel_Result(std::move(output));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cluster_snn_graph) {
    emscripten::function("cluster_snn_graph", &cluster_snn_graph);

    emscripten::class_<ClusterSNNGraphMultiLevel_Result>("ClusterSNNGraphMultiLevel_Result")
        .function("number", &ClusterSNNGraphMultiLevel_Result::number)
        .function("best", &ClusterSNNGraphMultiLevel_Result::best)
        .function("modularity", &ClusterSNNGraphMultiLevel_Result::modularity)
        .function("membership", &ClusterSNNGraphMultiLevel_Result::membership);
}
/**
 * @endcond
 */

