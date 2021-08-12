#include <emscripten/bind.h>

#include "scran/clustering/ClusterSNNGraph.hpp"
#include <algorithm>

struct MultilevelClusterResults {
    typedef scran::ClusterSNNGraph::MultiLevelResult Store;
    MultilevelClusterResults(Store s) : store(std::move(s)) {}

    Store store;

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

MultilevelClusterResults cluster_snn_graph(int ndim, int ncells, uintptr_t mat, int k, double resolution) {
    scran::ClusterSNNGraph clust;
    clust.set_neighbors(k);

    const double* ptr = reinterpret_cast<const double*>(mat);
    auto output = clust.run_multilevel(ndim, ncells, ptr, resolution);
    return MultilevelClusterResults(std::move(output));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cluster_snn_graph) {
    emscripten::function("cluster_snn_graph", &cluster_snn_graph);

    emscripten::class_<MultilevelClusterResults>("MultilevelClusterResults")
        .function("number", &MultilevelClusterResults::number)
        .function("best", &MultilevelClusterResults::best)
        .function("modularity", &MultilevelClusterResults::modularity)
        .function("membership", &MultilevelClusterResults::membership);
}
/**
 * @endcond
 */

