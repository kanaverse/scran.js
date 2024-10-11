#include <emscripten/bind.h>

#include <vector>
#include <algorithm>
#include <cstdint>

#include "build_snn_graph.h"

#include "scran_graph_cluster/scran_graph_cluster.hpp"

struct ClusterMultilevelResult {
    std::vector<double> modularity_by_level;
    int32_t best = 0;

    std::vector<int32_t> membership_best;
    std::vector<int32_t> membership_by_level;

public:
    ClusterMultilevelResult(scran_graph_cluster::ClusterMultilevelResults store) :
        modularity_by_level(store.modularity.begin(), store.modularity.end()),
        membership_best(store.membership.begin(), store.membership.end())
    {
        if (modularity_by_level.size()) {
            best = std::max_element(modularity_by_level.begin(), modularity_by_level.end()) - modularity_by_level.begin();
        }

        size_t NR = store.levels.nrow(), NC = store.levels.ncol();
        membership_by_level.resize(NR * NC);
        auto lIt = membership_by_level.begin();
        for (size_t r = 0; r < NR; ++r, lIt += NC) {
            auto row = store.levels.row(r);
            std::copy(row.begin(), row.end(), lIt);
        }
    }

public:
    int32_t num_levels() const {
        return modularity_by_level.size();
    }

    int32_t best_level() const {
        return best;
    }

    double modularity(int32_t i) const {
        if (i < 0) {
            i = best;
        }
        return modularity_by_level[i];
    }

    emscripten::val membership(int32_t i) const {
        size_t NC = membership_best.size();
        const int32_t* ptr;
        if (i < 0) {
            ptr = membership_best.data();
        } else {
            ptr = membership_by_level.data() + NC * static_cast<size_t>(i);
        }
        return emscripten::val(emscripten::typed_memory_view(NC, ptr));
    }
};

ClusterMultilevelResult cluster_multilevel(const BuildSnnGraphResult& graph, double resolution) {
    scran_graph_cluster::ClusterMultilevelOptions opt;
    opt.resolution = resolution;
    auto output = scran_graph_cluster::cluster_multilevel(graph.graph, graph.weights, opt);
    return ClusterMultilevelResult(std::move(output));
}

/**********************************/

struct ClusterWalktrapResult {
    typedef scran_graph_cluster::ClusterWalktrapResults Store;

    Store store;
    int32_t best = 0; 

public:
    ClusterWalktrapResult(Store s) : store(std::move(s)) {
        if (store.modularity.size()) {
            best = std::max_element(store.modularity.begin(), store.modularity.end()) - store.modularity.begin();
        }
    }

public:
    int32_t num_merge_steps() const {
        return store.merges.size();
    }

    double modularity(int32_t i) const {
        if (i < 0) {
            i = best;
        }
        return store.modularity[i];
    }

    emscripten::val membership() const {
        return emscripten::val(emscripten::typed_memory_view(store.membership.size(), store.membership.data()));
    }
};

ClusterWalktrapResult cluster_walktrap(const BuildSnnGraphResult& graph, int32_t steps) {
    scran_graph_cluster::ClusterWalktrapOptions opt;
    opt.steps = steps;
    auto output = scran_graph_cluster::cluster_walktrap(graph.graph, graph.weights, opt);
    return ClusterWalktrapResult(std::move(output));
}

/**********************************/

struct ClusterLeidenResult {
    typedef scran_graph_cluster::ClusterLeidenResults Store;

    Store store;

public:
    ClusterLeidenResult(Store s) : store(std::move(s)) {}

public:
    double quality() const {
        return store.quality;
    }

    emscripten::val membership() const {
        return emscripten::val(emscripten::typed_memory_view(store.membership.size(), store.membership.data()));
    }
};

ClusterLeidenResult cluster_leiden(const BuildSnnGraphResult& graph, double resolution, bool use_modularity) {
    scran_graph_cluster::ClusterLeidenOptions opt;
    opt.resolution = resolution;
    opt.modularity = use_modularity;
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
