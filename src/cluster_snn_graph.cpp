#include <emscripten/bind.h>

#include "NeighborIndex.h"
#include "parallel.h"

#include "scran/clustering/ClusterSNNGraph.hpp"
#include <algorithm>

/**
 * @file cluster_snn_graph.cpp
 *
 * @brief Identify clusters from a shared nearest-neighbor graph.
 */

/**
 * @brief Javascript-visible wrapper around the result of `scran::BuildSNNGraph::run()`.
 */
struct BuildSNNGraph_Result {
    /**
     * @cond
     **/
    typedef std::deque<scran::BuildSNNGraph::WeightedEdge> Edges;
    BuildSNNGraph_Result(size_t nc, Edges e) : ncells(nc), edges(std::move(e)) {}

    size_t ncells;
    Edges edges;
    /**
     * @endcond
     */
};

/**
 * Build an shared nearest neighbor graph from an existing nearest neighbor index.
 *
 * @param index A pre-built nearest neighbor index for the dataset.
 * @param k Number of neighbors to use in the graph.
 * @param scheme Weighting scheme to use for the edges.
 * This can be 0 (by highest shared rank), 1 (by number of shared neighbors) or 2 (by the Jaccard index of neighbor sets).
 *
 * @return A `BuildSNNGraph_Result` containing the graph information.
 */
BuildSNNGraph_Result build_snn_graph_from_index(const NeighborIndex& index, int k, int scheme) {
    scran::BuildSNNGraph builder;
    builder.set_neighbors(k).set_weighting_scheme(static_cast<scran::BuildSNNGraph::Scheme>(scheme));
    size_t nc = index.search->nobs();

#ifdef __EMSCRIPTEN_PTHREADS__
    std::vector<std::vector<int > > indices(nc);

    run_parallel([&](int left, int right) -> void {
        for (int i = left; i < right; ++i) {
            auto current = index.search->find_nearest_neighbors(i, k);
            auto& output = indices[i];
            for (const auto& y : current) {
                output.push_back(y.first);
            }
        }
    }, nc);

    return BuildSNNGraph_Result(nc, builder.run(indices));
#else
    return BuildSNNGraph_Result(nc, builder.run(index.search.get()));
#endif
}

/**
 * Build an shared nearest neighbor graph from an input matrix.
 *
 * @param[in] mat Offset to an array of `double`s containing per-cell coordinates (usually PCs).
 * @param nr Number of dimensions.
 * @param nc Number of cells.
 * @param k Number of neighbors to use in the graph.
 * @param scheme Weighting scheme to use for the edges.
 * This can be 0 (by highest shared rank), 1 (by number of shared neighbors) or 2 (by the Jaccard index of neighbor sets).
 * @param approximate Whether an approximate nearest neighbor search should be performed.
 *
 * @return A `BuildSNNGraph_Result` containing the graph information.
 */
BuildSNNGraph_Result build_snn_graph(uintptr_t mat, int nr, int nc, int k, int scheme, bool approximate) {
    NeighborIndex index = build_neighbor_index(mat, nr, nc, approximate);
    return build_snn_graph_from_index(index, k, scheme);                
}

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
 * @param graph An existing SNN graph for the dataset, usually constructed by `build_snn_graph()` or related functions.
 * @param resolution Resolution of the multi-level clustering, used in the modularity calculation.
 * Larger values yield more fine-grained clusters.
 *
 * @return A `ClusterSNNGraphMultiLevel_Result` object containing the... multi-level clustering results, obviously.
 */
ClusterSNNGraphMultiLevel_Result cluster_snn_graph_from_graph(const BuildSNNGraph_Result& graph, double resolution) {
    scran::ClusterSNNGraphMultiLevel clust;
    clust.set_resolution(resolution);
    auto output = clust.run(graph.ncells, graph.edges);
    return ClusterSNNGraphMultiLevel_Result(std::move(output));
}

/**
 * @param index An existing SNN graph for the dataset, usually constructed by `build_snn_graph()` or related functions.
 * @param k Number of neighbors to use in the graph.
 * @param scheme Weighting scheme to use for the edges.
 * This can be 0 (by highest shared rank), 1 (by number of shared neighbors) or 2 (by the Jaccard index of neighbor sets).
 * @param resolution Resolution of the multi-level clustering, used in the modularity calculation.
 * Larger values yield more fine-grained clusters.
 *
 * @return A `ClusterSNNGraphMultiLevel_Result` object.
 */
ClusterSNNGraphMultiLevel_Result cluster_snn_graph_from_index(const NeighborIndex& index, int k, int scheme, double resolution) {
    auto graph = build_snn_graph_from_index(index, k, scheme);
    return cluster_snn_graph_from_graph(graph, resolution);
}

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
 * @return A `ClusterSNNGraphMultiLevel_Result` object. 
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
    emscripten::function("build_snn_graph_from_index", &build_snn_graph_from_index);

    emscripten::function("build_snn_graph", &build_snn_graph);

    emscripten::function("cluster_snn_graph_from_graph", &cluster_snn_graph_from_graph);

    emscripten::function("cluster_snn_graph_from_index", &cluster_snn_graph_from_index);

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

