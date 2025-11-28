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

NeighborIndex js_build_neighbor_index(JsFakeInt mat_raw, JsFakeInt nr_raw, JsFakeInt nc_raw, bool approximate) {
    auto builder = create_builder(approximate);
    NeighborIndex output;
    const auto nr = js2int<std::size_t>(nr_raw);
    const auto nc = js2int<std::int32_t>(nc_raw);
    const double* ptr = reinterpret_cast<const double*>(js2int<std::uintptr_t>(mat_raw));
    output.index = builder->build_unique(knncolle::SimpleMatrix<std::int32_t, double>(nr, nc, ptr));
    return output;
}

NeighborResults js_find_nearest_neighbors(const NeighborIndex& index, JsFakeInt k_raw, JsFakeInt nthreads_raw) {
    return NeighborResults(knncolle::find_nearest_neighbors(*(index.index), js2int<int>(k_raw), js2int<int>(nthreads_raw)));
}

NeighborResults js_truncate_nearest_neighbors(const NeighborResults& input, JsFakeInt k_raw) {
    NeighborResults output;
    const auto nobs = input.neighbors().size();
    auto& out_neighbors = output.neighbors();
    sanisizer::resize(out_neighbors, nobs);

    auto& in_neighbors = input.neighbors();
    const auto desired = js2int<int>(k_raw);
    for (I<decltype(nobs)> i = 0; i < nobs; ++i) {
        const auto& current = in_neighbors[i];
        auto& curout = out_neighbors[i];
        const auto size = sanisizer::min(current.size(), desired);
        curout.insert(curout.end(), current.begin(), current.begin() + size);
    }
    return output;
}

EMSCRIPTEN_BINDINGS(build_neighbor_index) {
    emscripten::function("find_nearest_neighbors", &js_find_nearest_neighbors, emscripten::return_value_policy::take_ownership());

    emscripten::function("truncate_nearest_neighbors", &js_truncate_nearest_neighbors, emscripten::return_value_policy::take_ownership());

    emscripten::function("build_neighbor_index", &js_build_neighbor_index, emscripten::return_value_policy::take_ownership());

    emscripten::class_<NeighborIndex>("NeighborIndex")
        .function("num_obs", &NeighborIndex::js_num_obs, emscripten::return_value_policy::take_ownership())
        .function("num_dim", &NeighborIndex::js_num_dim, emscripten::return_value_policy::take_ownership())
        ;
    
    emscripten::class_<NeighborResults>("NeighborResults")
        .constructor<JsFakeInt, JsFakeInt, JsFakeInt, JsFakeInt>()
        .function("num_obs", &NeighborResults::js_num_obs, emscripten::return_value_policy::take_ownership())
        .function("num_neighbors", &NeighborResults::js_num_neighbors, emscripten::return_value_policy::take_ownership())
        .function("size", &NeighborResults::js_size, emscripten::return_value_policy::take_ownership())
        .function("serialize", &NeighborResults::js_serialize, emscripten::return_value_policy::take_ownership())
        ;
}
