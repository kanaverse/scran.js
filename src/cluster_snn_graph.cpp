#include <emscripten/bind.h>

#include <algorithm>
#include <memory>

#include "NeighborIndex.h"
#include "parallel.h"

#include "scran/clustering/ClusterSNNGraph.hpp"

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
    BuildSNNGraph_Result(scran::BuildSNNGraph::Results g) : graph(std::move(g)) {}

    scran::BuildSNNGraph::Results graph;
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
BuildSNNGraph_Result build_snn_graph(const NeighborResults& neighbors, std::string scheme, int nthreads) {
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
    builder.set_neighbors(k).set_weighting_scheme(chosen).set_num_threads(nthreads);
    return BuildSNNGraph_Result(builder.run(indices));
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

    ClusterSNNGraphMultiLevel_Result(int num_cells, int num_levels) {
        store.membership.resize(num_levels);
        for (auto& m : store.membership) {
            m.resize(num_cells);
        }
        store.modularity.resize(num_levels);
        store.max = 0;
        return;
    }

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

    void set_best(int b) {
        store.max = b;
        return;
    }

    /**
     * @param i Index of the level of interest.
     * @return Modularity of the clustering at that level.
     */
    double modularity(int i) const {
        return store.modularity[i];
    }

    void set_modularity(int i, double m) {
        store.modularity[i] = m;
        return;
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
ClusterSNNGraphMultiLevel_Result cluster_snn_graph_multilevel(const BuildSNNGraph_Result& graph, double resolution) {
    scran::ClusterSNNGraphMultiLevel clust;
    clust.set_resolution(resolution);
    auto output = clust.run(graph.graph);
    return ClusterSNNGraphMultiLevel_Result(std::move(output));
}

struct ClusterSNNGraphWalktrap_Result {
    typedef scran::ClusterSNNGraphWalktrap::Results Store;

    ClusterSNNGraphWalktrap_Result(Store s) : store(std::move(s)) {}

    ClusterSNNGraphWalktrap_Result(int num_cells, int num_merges) {
        store.membership.resize(num_cells);
        store.merges.resize(num_merges);
        store.modularity.resize(num_merges + 1);
        return;
    }

    Store store;

    int num_merge_steps() const {
        return store.merges.size();
    }

    double modularity(int i) const {
        if (i == -1) {
            if (store.modularity.empty()) {
                return 0;
            } else {
                return *std::max_element(store.modularity.begin(), store.modularity.end());
            }
        } else {
            return store.modularity[i];
        }
    }

    void set_modularity(int i, double m) {
        store.modularity[i] = m;
        return;
    }

    emscripten::val membership() const {
        const auto& current = store.membership;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

ClusterSNNGraphWalktrap_Result cluster_snn_graph_walktrap(const BuildSNNGraph_Result& graph, int steps) {
    scran::ClusterSNNGraphWalktrap clust;
    clust.set_steps(steps);
    auto output = clust.run(graph.graph);
    return ClusterSNNGraphWalktrap_Result(std::move(output));
}

struct ClusterSNNGraphLeiden_Result {
    typedef scran::ClusterSNNGraphLeiden::Results Store;

    ClusterSNNGraphLeiden_Result(Store s) : store(std::move(s)) {}

    ClusterSNNGraphLeiden_Result(int num_cells) {
        store.membership.resize(num_cells);
        return;
    }

    Store store;

    double modularity() const {
        return store.quality;
    }

    void set_modularity(double m) {
        store.quality = m;
        return;
    }

    emscripten::val membership() const {
        const auto& current = store.membership;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

ClusterSNNGraphLeiden_Result cluster_snn_graph_leiden(const BuildSNNGraph_Result& graph, double resolution, bool use_modularity) {
    scran::ClusterSNNGraphLeiden clust;
    clust.set_resolution(resolution);
    clust.set_modularity(use_modularity);
    auto output = clust.run(graph.graph);
    return ClusterSNNGraphLeiden_Result(std::move(output));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cluster_snn_graph) {
    emscripten::function("build_snn_graph", &build_snn_graph);

    emscripten::class_<BuildSNNGraph_Result>("BuildSNNGraph_Result");

    emscripten::function("cluster_snn_graph_multilevel", &cluster_snn_graph_multilevel);

    emscripten::class_<ClusterSNNGraphMultiLevel_Result>("ClusterSNNGraphMultiLevel_Result")
        .constructor<int, int>()
        .function("number", &ClusterSNNGraphMultiLevel_Result::number)
        .function("best", &ClusterSNNGraphMultiLevel_Result::best)
        .function("set_best", &ClusterSNNGraphMultiLevel_Result::set_best)
        .function("modularity", &ClusterSNNGraphMultiLevel_Result::modularity)
        .function("set_modularity", &ClusterSNNGraphMultiLevel_Result::set_modularity)
        .function("membership", &ClusterSNNGraphMultiLevel_Result::membership)
        ;

    emscripten::function("cluster_snn_graph_walktrap", &cluster_snn_graph_walktrap);

    emscripten::class_<ClusterSNNGraphWalktrap_Result>("ClusterSNNGraphWalktrap_Result")
        .constructor<int, int>()
        .function("modularity", &ClusterSNNGraphWalktrap_Result::modularity)
        .function("membership", &ClusterSNNGraphWalktrap_Result::membership)
        .function("set_modularity", &ClusterSNNGraphWalktrap_Result::set_modularity)
        .function("num_merge_steps", &ClusterSNNGraphWalktrap_Result::num_merge_steps)
        ;

    emscripten::function("cluster_snn_graph_leiden", &cluster_snn_graph_leiden);

    emscripten::class_<ClusterSNNGraphLeiden_Result>("ClusterSNNGraphLeiden_Result")
        .constructor<int>()
        .function("modularity", &ClusterSNNGraphLeiden_Result::modularity)
        .function("membership", &ClusterSNNGraphLeiden_Result::membership)
        .function("set_modularity", &ClusterSNNGraphLeiden_Result::set_modularity)
        ;
}
/**
 * @endcond
 */

