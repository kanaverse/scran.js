#include <emscripten/bind.h>

#include "scran/clustering/ClusterSNNGraph.hpp"
#include <algorithm>

void cluster_snn_graph(int ndim, int ncells, uintptr_t mat, int k, double resolution, uintptr_t membership) {
    scran::ClusterSNNGraph clust;
    clust.set_neighbors(k);

    const double* ptr = reinterpret_cast<const double*>(mat);
    auto output = clust.run_multilevel(ndim, ncells, ptr, resolution);

    const auto& chosen = output.membership[output.max];
    std::copy(chosen.begin(), chosen.end(), reinterpret_cast<int32_t*>(membership));

    return;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(cluster_snn_graph) {
    emscripten::function("cluster_snn_graph", &cluster_snn_graph);
}
/**
 * @endcond
 */

