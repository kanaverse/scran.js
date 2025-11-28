#include <emscripten/bind.h>

#include "NeighborIndex.h"

#include "knncolle/knncolle.hpp"
#include "knncolle_annoy/knncolle_annoy.hpp"

#include <algorithm>
#include <cstdint>
#include <cstddef>

std::unique_ptr<knncolle::Builder<std::int32_t, double, double, knncolle::SimpleMatrix<std::int32_t, double> > > create_builder(bool approximate) {
    if (approximate) {
        knncolle_annoy::AnnoyOptions opt;
        return std::make_unique<
            knncolle_annoy::AnnoyBuilder<
                std::int32_t,
                double,
                double,
                Annoy::Euclidean,
                /* AnnoyIndex_ = */ std::int32_t,
                /* AnnoyData_ = */ float,
                /* AnnoyRng_ = */ Annoy::Kiss64Random,
                /* AnnoyThreadPolicy_ = */ Annoy::AnnoyIndexSingleThreadedBuildPolicy,
                /* Matrix_ = */ knncolle::SimpleMatrix<std::int32_t, double>
            >
        >(opt);
    } else {
        return std::make_unique<
            knncolle::VptreeBuilder<
                std::int32_t,
                double,
                double,
                knncolle::SimpleMatrix<std::int32_t, double>,
                knncolle::EuclideanDistance<double, double>
            >
        >(
            std::make_shared<knncolle::EuclideanDistance<double, double> >()
        );
    }
}

NeighborIndex build_neighbor_index(std::uintptr_t mat, JsFakeInt nr_raw, JsFakeInt nc_raw, bool approximate) {
    auto builder = create_builder(approximate);
    NeighborIndex output;
    const double* ptr = reinterpret_cast<const double*>(mat);
    output.index = builder->build_unique(knncolle::SimpleMatrix<std::int32_t, double>(js2int<std::size_t>(nr_raw), js2int<std::int32_t>(nc_raw), ptr));
    return output;
}

NeighborResults find_nearest_neighbors(const NeighborIndex& index, JsFakeInt k_raw, JsFakeInt nthreads_raw) {
    NeighborResults output;
    output.neighbors = knncolle::find_nearest_neighbors(*(index.index), js2int<int>(k_raw), js2int<int>(nthreads_raw));
    return output;
}

NeighborResults truncate_nearest_neighbors(const NeighborResults& original, JsFakeInt k_raw) {
    NeighborResults output;
    const auto nobs = original.neighbors.size();
    output.neighbors.resize(nobs);
    const auto desired = js2int<int>(k_raw);
    for (I<decltype(nobs)> i = 0; i < nobs; ++i) {
        const auto& current = original.neighbors[i];
        auto& curout = output.neighbors[i];
        const auto size = sanisizer::min(current.size(), desired);
        curout.insert(curout.end(), current.begin(), current.begin() + size);
    }
    return output;
}

EMSCRIPTEN_BINDINGS(build_neighbor_index) {
    emscripten::function("find_nearest_neighbors", &find_nearest_neighbors, emscripten::return_value_policy::take_ownership());

    emscripten::function("truncate_nearest_neighbors", &truncate_nearest_neighbors, emscripten::return_value_policy::take_ownership());

    emscripten::function("build_neighbor_index", &build_neighbor_index, emscripten::return_value_policy::take_ownership());

    emscripten::class_<NeighborIndex>("NeighborIndex")
        .function("num_obs", &NeighborIndex::num_obs, emscripten::return_value_policy::take_ownership())
        .function("num_dim", &NeighborIndex::num_dim, emscripten::return_value_policy::take_ownership());
    
    emscripten::class_<NeighborResults>("NeighborResults")
        .constructor<size_t, uintptr_t, uintptr_t, uintptr_t>()
        .function("num_obs", &NeighborResults::num_obs, emscripten::return_value_policy::take_ownership())
        .function("num_neighbors", &NeighborResults::num_neighbors, emscripten::return_value_policy::take_ownership())
        .function("size", &NeighborResults::size, emscripten::return_value_policy::take_ownership())
        .function("serialize", &NeighborResults::serialize, emscripten::return_value_policy::take_ownership());
}
