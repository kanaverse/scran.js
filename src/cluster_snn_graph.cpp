#include <emscripten/bind.h>

#include "NeighborIndex.h"
#include "parallel.h"

#include "scran/clustering/ClusterSNNGraph.hpp"
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
 * Build an shared nearest neighbor graph from existing neighbor search results.
 *
 * @param neighbors Pre-computed nearest neighbors for this dataset.
 * @param scheme Weighting scheme to use for the edges.
 * This can be done by highest shared `"rank"`, by `"number"` of shared neighbors, or by the `"jaccard"` index of nearest neighbor sets.
 *
 * @return A `BuildSNNGraph_Result` containing the graph information.
 */
BuildSNNGraph_Result build_snn_graph(const NeighborResults& neighbors, std::string scheme) {
    size_t nc = neighbors.neighbors.size();
    std::vector<std::vector<int > > indices(nc);
    int k = 0;

    for (size_t i = 0; i < nc; ++i) {
        auto current = neighbors.neighbors[i];
        auto& output = indices[i];
        k = current.size(); // just in case BuildSNNGraph needs the neighbors to be set.
        for (const auto& y : current) {
            output.push_back(y.first);
        }
    }

    auto chosen = scran::BuildSNNGraph::RANKED;
    if (scheme == "rank") {
        ;
    } else if (scheme == "number") {
        chosen = scran::BuildSNNGraph::NUMBER;
    } else if (scheme == "jaccard") {
        chosen = scran::BuildSNNGraph::JACCARD;
    } else {
        throw std::runtime_error("no known weighting scheme '" + scheme + "'");
    }

    scran::BuildSNNGraph builder;
    builder.set_neighbors(k).set_weighting_scheme(chosen);
    return BuildSNNGraph_Result(nc, builder.run(indices));
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
ClusterSNNGraphMultiLevel_Result cluster_snn_graph(const BuildSNNGraph_Result& graph, double resolution) {
    scran::ClusterSNNGraphMultiLevel clust;
    clust.set_resolution(resolution);
    auto output = clust.run(graph.ncells, graph.edges);
    return ClusterSNNGraphMultiLevel_Result(std::move(output));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cluster_snn_graph) {
    emscripten::function("build_snn_graph", &build_snn_graph);

    emscripten::function("cluster_snn_graph", &cluster_snn_graph);

    emscripten::class_<BuildSNNGraph_Result>("BuildSNNGraph_Result");

    emscripten::class_<ClusterSNNGraphMultiLevel_Result>("ClusterSNNGraphMultiLevel_Result")
        .function("number", &ClusterSNNGraphMultiLevel_Result::number)
        .function("best", &ClusterSNNGraphMultiLevel_Result::best)
        .function("modularity", &ClusterSNNGraphMultiLevel_Result::modularity)
        .function("membership", &ClusterSNNGraphMultiLevel_Result::membership);
}
/**
 * @endcond
 */

