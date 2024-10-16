#include <emscripten/bind.h>

#include <algorithm>
#include <memory>

#include "kmeans/kmeans.hpp"

struct ClusterKmeansResult {
    kmeans::Results<int32_t, double, int32_t> store;

    ClusterKmeansResult(kmeans::Results<int32_t, double, int32_t> s) : store(std::move(s)) {}

public:
    int32_t num_obs() const {
        return store.clusters.size();
    }

    int32_t num_clusters() const {
        return store.details.sizes.size();
    }

    emscripten::val clusters() const {
        const auto& c = store.clusters;
        return emscripten::val(emscripten::typed_memory_view(c.size(), c.data()));
    }

    emscripten::val cluster_sizes() const {
        const auto& s = store.details.sizes;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }

    int32_t iterations() const {
        return store.details.iterations;
    }

    int32_t status() const {
        return store.details.status;
    }

    emscripten::val centers() const {
        const auto& s = store.centers;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }
};

ClusterKmeansResult cluster_kmeans(
    uintptr_t mat,
    int32_t nr,
    int32_t nc,
    int32_t k,
    std::string init_method,
    int32_t init_seed,
    double init_varpart_size_adjust,
    double init_varpart_optimized,
    std::string refine_method,
    int32_t refine_lloyd_iterations,
    int32_t refine_hw_iterations,
    int32_t nthreads)
{
    kmeans::SimpleMatrix<double, int32_t, int32_t> smat(nr, nc, reinterpret_cast<const double*>(mat));

    std::unique_ptr<kmeans::Initialize<decltype(smat), int32_t, double> > iptr;
    if (init_method == "random") {
        auto iptr2 = new kmeans::InitializeRandom<decltype(smat), int32_t, double>;
        iptr.reset(iptr2);
        iptr2->get_options().seed = init_seed;

    } else if (init_method == "kmeans++") {
        auto iptr2 = new kmeans::InitializeKmeanspp<decltype(smat), int32_t, double>;
        iptr.reset(iptr2);
        iptr2->get_options().seed = init_seed;
        iptr2->get_options().num_threads = nthreads;

    } else if (init_method == "var-part") {
        auto iptr2 = new kmeans::InitializeVariancePartition<decltype(smat), int32_t, double>;
        iptr.reset(iptr2);
        iptr2->get_options().size_adjustment = init_varpart_size_adjust;
        iptr2->get_options().optimize_partition = init_varpart_optimized;

    } else {
        throw std::runtime_error("unknown initialization method '" + init_method + "'");
    }

    std::unique_ptr<kmeans::Refine<decltype(smat), int32_t, double> > rptr;
    if (refine_method == "lloyd") {
        auto rptr2 = new kmeans::RefineLloyd<decltype(smat), int32_t, double>;
        rptr.reset(rptr2);
        rptr2->get_options().max_iterations = refine_lloyd_iterations;
        rptr2->get_options().num_threads = nthreads;

    } else if (refine_method == "hartigan-wong") {
        auto rptr2 = new kmeans::RefineHartiganWong<decltype(smat), int32_t, double>;
        rptr.reset(rptr2);
        rptr2->get_options().max_iterations = refine_hw_iterations;

    } else {
        throw std::runtime_error("unknown refinement method '" + refine_method + "'");
    }

    auto output = kmeans::compute(smat, *iptr, *rptr, k);
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
