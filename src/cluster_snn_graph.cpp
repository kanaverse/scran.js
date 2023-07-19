#include <emscripten/bind.h>

#include <algorithm>
#include <memory>

#include "NeighborIndex.h"
#include "parallel.h"

#include "scran/scran.hpp"

struct BuildSnnGraph_Result {
    BuildSnnGraph_Result(scran::BuildSnnGraph::Results g) : graph(std::move(g)) {}

    scran::BuildSnnGraph::Results graph;
};

BuildSnnGraph_Result build_snn_graph(const NeighborResults& neighbors, std::string scheme, int nthreads) {
    size_t nc = neighbors.neighbors.size();
    std::vector<std::vector<int > > indices(nc);
    int k = 0;

    for (size_t i = 0; i < nc; ++i) {
        auto current = neighbors.neighbors[i];
        auto& output = indices[i];
        k = current.size(); // just in case BuildSnnGraph needs the neighbors to be set.
        for (const auto& y : current) {
            output.push_back(y.first);
        }
    }

    auto chosen = scran::BuildSnnGraph::RANKED;
    if (scheme == "rank") {
        ;
    } else if (scheme == "number") {
        chosen = scran::BuildSnnGraph::NUMBER;
    } else if (scheme == "jaccard") {
        chosen = scran::BuildSnnGraph::JACCARD;
    } else {
        throw std::runtime_error("no known weighting scheme '" + scheme + "'");
    }

    scran::BuildSnnGraph builder;
    builder.set_neighbors(k).set_weighting_scheme(chosen).set_num_threads(nthreads);
    return BuildSnnGraph_Result(builder.run(indices));
}

/**********************************/

struct ClusterSnnGraphMultiLevel_Result {
    typedef scran::ClusterSnnGraphMultiLevel::Results Store;

    ClusterSnnGraphMultiLevel_Result(Store s) : store(std::move(s)) {}

    Store store;

public:
    int number() const {
        return store.membership.size();
    }

    int best() const {
        return store.max;
    }

    double modularity(int i) const {
        return store.modularity[i];
    }

    emscripten::val membership(int i) const {
        const auto& current = store.membership[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

ClusterSnnGraphMultiLevel_Result cluster_snn_graph_multilevel(const BuildSnnGraph_Result& graph, double resolution) {
    scran::ClusterSnnGraphMultiLevel clust;
    clust.set_resolution(resolution);
    auto output = clust.run(graph.graph);
    return ClusterSnnGraphMultiLevel_Result(std::move(output));
}

/**********************************/

struct ClusterSnnGraphWalktrap_Result {
    typedef scran::ClusterSnnGraphWalktrap::Results Store;

    ClusterSnnGraphWalktrap_Result(Store s) : store(std::move(s)) {}

    Store store;

public:
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

    emscripten::val membership() const {
        const auto& current = store.membership;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

ClusterSnnGraphWalktrap_Result cluster_snn_graph_walktrap(const BuildSnnGraph_Result& graph, int steps) {
    scran::ClusterSnnGraphWalktrap clust;
    clust.set_steps(steps);
    auto output = clust.run(graph.graph);
    return ClusterSnnGraphWalktrap_Result(std::move(output));
}

/**********************************/

struct ClusterSnnGraphLeiden_Result {
    typedef scran::ClusterSnnGraphLeiden::Results Store;

    ClusterSnnGraphLeiden_Result(Store s) : store(std::move(s)) {}

    Store store;

public:
    double modularity() const {
        return store.quality;
    }

    emscripten::val membership() const {
        const auto& current = store.membership;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

ClusterSnnGraphLeiden_Result cluster_snn_graph_leiden(const BuildSnnGraph_Result& graph, double resolution, bool use_modularity) {
    scran::ClusterSnnGraphLeiden clust;
    clust.set_resolution(resolution);
    clust.set_modularity(use_modularity);
    auto output = clust.run(graph.graph);
    return ClusterSnnGraphLeiden_Result(std::move(output));
}

/**********************************/

EMSCRIPTEN_BINDINGS(cluster_snn_graph) {
    emscripten::function("build_snn_graph", &build_snn_graph);

    emscripten::class_<BuildSnnGraph_Result>("BuildSnnGraph_Result");

    emscripten::function("cluster_snn_graph_multilevel", &cluster_snn_graph_multilevel);

    emscripten::class_<ClusterSnnGraphMultiLevel_Result>("ClusterSnnGraphMultiLevel_Result")
        .function("number", &ClusterSnnGraphMultiLevel_Result::number)
        .function("best", &ClusterSnnGraphMultiLevel_Result::best)
        .function("modularity", &ClusterSnnGraphMultiLevel_Result::modularity)
        .function("membership", &ClusterSnnGraphMultiLevel_Result::membership)
        ;

    emscripten::function("cluster_snn_graph_walktrap", &cluster_snn_graph_walktrap);

    emscripten::class_<ClusterSnnGraphWalktrap_Result>("ClusterSnnGraphWalktrap_Result")
        .function("modularity", &ClusterSnnGraphWalktrap_Result::modularity)
        .function("membership", &ClusterSnnGraphWalktrap_Result::membership)
        .function("num_merge_steps", &ClusterSnnGraphWalktrap_Result::num_merge_steps)
        ;

    emscripten::function("cluster_snn_graph_leiden", &cluster_snn_graph_leiden);

    emscripten::class_<ClusterSnnGraphLeiden_Result>("ClusterSnnGraphLeiden_Result")
        .function("modularity", &ClusterSnnGraphLeiden_Result::modularity)
        .function("membership", &ClusterSnnGraphLeiden_Result::membership)
        ;
}
