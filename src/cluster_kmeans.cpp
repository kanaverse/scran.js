#include <emscripten/bind.h>

#include <algorithm>
#include <memory>

#include "parallel.h"

#include "kmeans/Kmeans.hpp"
#include "kmeans/InitializePCAPartition.hpp"

struct ClusterKmeans_Result {
    kmeans::Kmeans<>::Results store;

    ClusterKmeans_Result(kmeans::Kmeans<>::Results s) : store(std::move(s)) {}

public:
    size_t num_obs() const {
        return store.clusters.size();
    }

    size_t num_clusters() const {
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

    emscripten::val wcss() const {
        const auto& s = store.details.withinss;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }

    int iterations() const {
        return store.details.iterations;
    }

    int status() const {
        return store.details.status;
    }

    emscripten::val centers() const {
        const auto& s = store.centers;
        return emscripten::val(emscripten::typed_memory_view(s.size(), s.data()));
    }
};

ClusterKmeans_Result cluster_kmeans(uintptr_t mat, int nr, int nc, int k, std::string init_method, int init_seed, double init_pca_adjust, int nthreads) {
    const double* ptr = reinterpret_cast<const double*>(mat);

    std::shared_ptr<kmeans::Initialize<> > iptr;
    if (init_method == "random") {
        auto iptr2 = new kmeans::InitializeRandom<>;
        iptr.reset(iptr2);
        iptr2->set_seed(init_seed);

    } else if (init_method == "kmeans++") {
        auto iptr2 = new kmeans::InitializeKmeansPP<>;
        iptr.reset(iptr2);
        iptr2->set_seed(init_seed);
        iptr2->set_num_threads(nthreads);

    } else if (init_method == "pca-part") {
        auto iptr2 = new kmeans::InitializePCAPartition<>;
        iptr.reset(iptr2);
        iptr2->set_seed(init_seed);
        iptr2->set_size_adjustment(init_pca_adjust);

    } else {
        throw std::runtime_error("unknown initialization method '" + init_method + "'");
    }

    kmeans::Kmeans clust;
    clust.set_num_threads(nthreads);
    auto output = clust.run(nr, nc, ptr, k, iptr.get());

    return ClusterKmeans_Result(std::move(output));
}

EMSCRIPTEN_BINDINGS(cluster_kmeans) {
    emscripten::function("cluster_kmeans", &cluster_kmeans);

    emscripten::class_<ClusterKmeans_Result>("ClusterKmeans_Result")
        .function("num_obs", &ClusterKmeans_Result::num_obs)
        .function("num_clusters", &ClusterKmeans_Result::num_clusters)
        .function("cluster_sizes", &ClusterKmeans_Result::cluster_sizes)
        .function("wcss", &ClusterKmeans_Result::wcss)
        .function("clusters", &ClusterKmeans_Result::clusters)
        .function("centers", &ClusterKmeans_Result::centers)
        .function("iterations", &ClusterKmeans_Result::iterations)
        .function("status", &ClusterKmeans_Result::status)
        ;
}
