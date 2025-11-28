#include <emscripten/bind.h>

#include <vector>
#include <algorithm>
#include <cstdint>

#include "build_snn_graph.h"
#include "utils.h"

#include "scran_graph_cluster/scran_graph_cluster.hpp"
#include "sanisizer/sanisizer.hpp"

class ClusterMultilevelResult {
    typedef scran_graph_cluster::ClusterMultilevelResults Store;

    Store my_store;
    std::size_t my_best = 0;
    raiigraph::IntegerVector my_buffer;

public:
    ClusterMultilevelResult(scran_graph_cluster::ClusterMultilevelResults store) : my_store(std::move(store)) {
        if (store.modularity.size()) {
            sanisizer::can_ptrdiff<I<decltype(store.modularity.begin())> >(store.modularity.size());
            my_best = std::max_element(my_store.modularity.begin(), my_store.modularity.end()) - my_store.modularity.begin();
        }
    }

public:
    JsFakeInt num_levels() const {
        return int2js(my_store.modularity.size());
    }

    JsFakeInt best_level() const {
        return int2js(my_best);
    }

    double modularity(JsFakeInt i_raw) const {
        return my_store.modularity[js2int<std::size_t>(i_raw)];
    }

    emscripten::val membership(JsFakeInt i_raw) {
        sanisizer::resize(my_buffer, my_store.levels.nrow());
        auto row = my_store.levels.row(js2int<std::size_t>(i_raw));
        std::copy(row.begin(), row.end(), my_buffer.begin());
        return emscripten::val(emscripten::typed_memory_view(my_buffer.size(), my_buffer.data()));
    }

    double best_modularity() const {
        return my_store.modularity[my_best];
    }

    emscripten::val best_membership() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.membership.size(), my_store.membership.data()));
    }
};

ClusterMultilevelResult cluster_multilevel(const BuildSnnGraphResult& graph, double resolution) {
    scran_graph_cluster::ClusterMultilevelOptions opt;
    opt.resolution = resolution;
    auto output = scran_graph_cluster::cluster_multilevel(graph.graph, graph.weights, opt);
    return ClusterMultilevelResult(std::move(output));
}

/**********************************/

class ClusterWalktrapResult {
    typedef scran_graph_cluster::ClusterWalktrapResults Store;

    Store my_store;
    std::size_t my_best = 0; 

public:
    ClusterWalktrapResult(Store s) : my_store(std::move(s)) {
        if (my_store.modularity.size()) {
            sanisizer::can_ptrdiff<I<decltype(my_store.modularity.begin())> >(my_store.modularity.size());
            my_best = std::max_element(my_store.modularity.begin(), my_store.modularity.end()) - my_store.modularity.begin();
        }
    }

public:
    JsFakeInt num_merge_steps() const {
        return int2js(my_store.merges.size());
    }

    double modularity(JsFakeInt i_raw) const {
        return my_store.modularity[js2int<std::size_t>(i_raw)];
    }

    double best_modularity() const {
        return my_store.modularity[my_best];
    }

    emscripten::val membership() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.membership.size(), my_store.membership.data()));
    }
};

ClusterWalktrapResult cluster_walktrap(const BuildSnnGraphResult& graph, JsFakeInt steps_raw) {
    scran_graph_cluster::ClusterWalktrapOptions opt;
    opt.steps = js2int<igraph_int_t>(steps_raw);
    auto output = scran_graph_cluster::cluster_walktrap(graph.graph, graph.weights, opt);
    return ClusterWalktrapResult(std::move(output));
}

/**********************************/

class ClusterLeidenResult {
    typedef scran_graph_cluster::ClusterLeidenResults Store;

    Store my_store;

public:
    ClusterLeidenResult(Store s) : my_store(std::move(s)) {}

public:
    double quality() const {
        return my_store.quality;
    }

    emscripten::val membership() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.membership.size(), my_store.membership.data()));
    }
};

ClusterLeidenResult cluster_leiden(const BuildSnnGraphResult& graph, double resolution, std::string objective) {
    scran_graph_cluster::ClusterLeidenOptions opt;
    opt.resolution = resolution;

    if (objective == "modularity") {
        opt.objective = IGRAPH_LEIDEN_OBJECTIVE_MODULARITY;
    } else if (objective == "cpm") {
        opt.objective = IGRAPH_LEIDEN_OBJECTIVE_CPM;
    } else if (objective == "er") {
        opt.objective = IGRAPH_LEIDEN_OBJECTIVE_ER;
    } else {
        throw std::runtime_error("unknown objective '" + objective + "'");
    }

    auto output = scran_graph_cluster::cluster_leiden(graph.graph, graph.weights, opt);
    return ClusterLeidenResult(std::move(output));
}

/**********************************/

EMSCRIPTEN_BINDINGS(cluster_graph) {
    emscripten::function("cluster_multilevel", &cluster_multilevel, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ClusterMultilevelResult>("ClusterMultilevelResult")
        .function("num_levels", &ClusterMultilevelResult::num_levels, emscripten::return_value_policy::take_ownership())
        .function("best_level", &ClusterMultilevelResult::best_level, emscripten::return_value_policy::take_ownership())
        .function("modularity", &ClusterMultilevelResult::modularity, emscripten::return_value_policy::take_ownership())
        .function("membership", &ClusterMultilevelResult::membership, emscripten::return_value_policy::take_ownership())
        .function("best_modularity", &ClusterMultilevelResult::best_modularity, emscripten::return_value_policy::take_ownership())
        .function("best_membership", &ClusterMultilevelResult::best_membership, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("cluster_walktrap", &cluster_walktrap, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ClusterWalktrapResult>("ClusterWalktrapResult")
        .function("modularity", &ClusterWalktrapResult::modularity, emscripten::return_value_policy::take_ownership())
        .function("membership", &ClusterWalktrapResult::membership, emscripten::return_value_policy::take_ownership())
        .function("num_merge_steps", &ClusterWalktrapResult::num_merge_steps, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("cluster_leiden", &cluster_leiden, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ClusterLeidenResult>("ClusterLeidenResult")
        .function("quality", &ClusterLeidenResult::quality, emscripten::return_value_policy::take_ownership())
        .function("membership", &ClusterLeidenResult::membership, emscripten::return_value_policy::take_ownership())
        ;
}
