#ifndef BUILD_SNN_GRAPH_H
#define BUILD_SNN_GRAPH_H

#include "igraph.h"
#include "raiigraph/raiigraph.hpp"
#include "scran_graph_cluster/scran_graph_cluster.hpp"

#include <vector>

struct BuildSnnGraphResult {
    BuildSnnGraphResult(scran_graph_cluster::BuildSnnGraphResults<igraph_integer_t, igraph_real_t> g) : 
        graph(scran_graph_cluster::convert_to_graph(g)),
        weights(std::move(g.weights))
    {}

    raiigraph::Graph graph;
    std::vector<igraph_real_t> weights;
};

#endif
