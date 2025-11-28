#include <emscripten/bind.h>

#include <algorithm>
#include <memory>
#include <cstdint>
#include <cstddef>

#include "utils.h"

#include "kmeans/kmeans.hpp"

class ClusterKmeansResult {
private:
    kmeans::Results<std::int32_t, std::int32_t, double> my_store;

public:
    ClusterKmeansResult(kmeans::Results<std::int32_t, std::int32_t, double> s) : my_store(std::move(s)) {}

    const auto& store() const {
        return my_store;
    }

public:
    JsFakeInt num_obs() const {
        return int2js(my_store.clusters.size());
    }

    JsFakeInt num_clusters() const {
        return int2js(my_store.details.sizes.size());
    }

    emscripten::val clusters() const {
        const auto& c = my_store.clusters;
        return emscripten::val(emscripten::typed_memory_view(c.size(), c.data()));
    }

    emscripten::val cluster_sizes() const {
        const auto& s = my_store.details.sizes;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }

    JsFakeInt iterations() const {
        return int2js(my_store.details.iterations);
    }

    JsFakeInt status() const {
        return int2js(my_store.details.status);
    }

    emscripten::val centers() const {
        const auto& s = my_store.centers;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }
};

ClusterKmeansResult cluster_kmeans(
    JsFakeInt mat_raw,
    JsFakeInt nr_raw,
    JsFakeInt nc_raw,
    JsFakeInt k_raw,
    std::string init_method,
    JsFakeInt init_seed_raw,
    double init_varpart_size_adjust,
    double init_varpart_optimized,
    std::string refine_method,
    JsFakeInt refine_lloyd_iterations_raw,
    JsFakeInt refine_hw_iterations_raw,
    JsFakeInt nthreads_raw
) {
    kmeans::SimpleMatrix<std::int32_t, double> smat(
        js2int<std::size_t>(nr_raw),
        js2int<std::int32_t>(nc_raw),
        reinterpret_cast<const double*>(js2int<std::uintptr_t>(mat_raw))
    );

    std::unique_ptr<kmeans::Initialize<std::int32_t, double, std::int32_t, double, I<decltype(smat)> > > iptr;
    if (init_method == "random") {
        auto iptr2 = new kmeans::InitializeRandom<std::int32_t, double, std::int32_t, double, I<decltype(smat)> >;
        iptr.reset(iptr2);
        iptr2->get_options().seed = js2int<std::uint64_t>(init_seed_raw);

    } else if (init_method == "kmeans++") {
        auto iptr2 = new kmeans::InitializeKmeanspp<std::int32_t, double, std::int32_t, double, I<decltype(smat)> >;
        iptr.reset(iptr2);
        iptr2->get_options().seed = js2int<std::uint64_t>(init_seed_raw);
        iptr2->get_options().num_threads = js2int<int>(nthreads_raw);

    } else if (init_method == "var-part") {
        auto iptr2 = new kmeans::InitializeVariancePartition<std::int32_t, double, std::int32_t, double, I<decltype(smat)> >;
        iptr.reset(iptr2);
        iptr2->get_options().size_adjustment = init_varpart_size_adjust;
        iptr2->get_options().optimize_partition = init_varpart_optimized;

    } else {
        throw std::runtime_error("unknown initialization method '" + init_method + "'");
    }

    std::unique_ptr<kmeans::Refine<std::int32_t, double, std::int32_t, double, I<decltype(smat)> > > rptr;
    if (refine_method == "lloyd") {
        auto rptr2 = new kmeans::RefineLloyd<std::int32_t, double, std::int32_t, double, I<decltype(smat)> >;
        rptr.reset(rptr2);
        rptr2->get_options().max_iterations = js2int<int>(refine_lloyd_iterations_raw);
        rptr2->get_options().num_threads = js2int<int>(nthreads_raw);

    } else if (refine_method == "hartigan-wong") {
        auto rptr2 = new kmeans::RefineHartiganWong<std::int32_t, double, std::int32_t, double, I<decltype(smat)> >;
        rptr.reset(rptr2);
        rptr2->get_options().max_iterations = js2int<int>(refine_hw_iterations_raw);

    } else {
        throw std::runtime_error("unknown refinement method '" + refine_method + "'");
    }

    auto output = kmeans::compute(smat, *iptr, *rptr, js2int<std::int32_t>(k_raw));
    return ClusterKmeansResult(std::move(output));
}

EMSCRIPTEN_BINDINGS(cluster_kmeans) {
    emscripten::function("cluster_kmeans", &cluster_kmeans, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ClusterKmeansResult>("ClusterKmeansResult")
        .function("num_obs", &ClusterKmeansResult::num_obs, emscripten::return_value_policy::take_ownership())
        .function("num_clusters", &ClusterKmeansResult::num_clusters, emscripten::return_value_policy::take_ownership())
        .function("cluster_sizes", &ClusterKmeansResult::cluster_sizes, emscripten::return_value_policy::take_ownership())
        .function("clusters", &ClusterKmeansResult::clusters, emscripten::return_value_policy::take_ownership())
        .function("centers", &ClusterKmeansResult::centers, emscripten::return_value_policy::take_ownership())
        .function("iterations", &ClusterKmeansResult::iterations, emscripten::return_value_policy::take_ownership())
        .function("status", &ClusterKmeansResult::status, emscripten::return_value_policy::take_ownership())
        ;
}
