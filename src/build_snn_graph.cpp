#include <emscripten/bind.h>

#include <stdexcept>
#include <string>

#include "NeighborIndex.h"
#include "build_snn_graph.h"

BuildSnnGraphResult build_snn_graph(const NeighborResults& neighbors, std::string scheme, int32_t nthreads) {
    scran_graph_cluster::BuildSnnGraphOptions opt;
    opt.num_threads = nthreads;

    if (scheme == "rank") {
        opt.weighting_scheme = scran_graph_cluster::SnnWeightScheme::RANKED;
    } else if (scheme == "number") {
        opt.weighting_scheme = scran_graph_cluster::SnnWeightScheme::NUMBER;
    } else if (scheme == "jaccard") {
        opt.weighting_scheme = scran_graph_cluster::SnnWeightScheme::JACCARD;
    } else {
        throw std::runtime_error("no known weighting scheme '" + scheme + "'");
    }

    return BuildSnnGraphResult(scran_graph_cluster::build_snn_graph(neighbors.neighbors, opt));
}

EMSCRIPTEN_BINDINGS(build_snn_graph) {
    emscripten::function("build_snn_graph", &build_snn_graph, emscripten::return_value_policy::take_ownership());

    emscripten::class_<BuildSnnGraphResult>("BuildSnnGraphResult");
}
