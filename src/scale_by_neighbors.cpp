#include <emscripten/bind.h>

#include <vector>
#include <cstdint>
#include <cstddef>

#include "NeighborIndex.h"
#include "utils.h"

#include "mumosa/mumosa.hpp"

void js_scale_by_neighbors(
    JsFakeInt nembed_raw,
    JsFakeInt embeddings_raw,
    JsFakeInt indices_raw,
    JsFakeInt combined_raw,
    JsFakeInt num_neighbors,
    bool use_weights,
    JsFakeInt weights_raw,
    JsFakeInt nthreads_raw
) {
    const auto nembed = js2int<std::size_t>(nembed_raw);
    auto index_ptrs = convert_array_of_offsets<const NeighborIndex*>(nembed, indices_raw);

    std::vector<std::size_t> ndims;
    ndims.reserve(nembed);
    std::vector<std::pair<double, double> > distances;
    distances.reserve(nembed);

    mumosa::Options opt;
    opt.num_neighbors = num_neighbors;
    opt.num_threads = js2int<int>(nthreads_raw);

    const std::int32_t num_cells = (nembed ? index_ptrs.front()->ptr()->num_observations() : 0);
    auto buffer = sanisizer::create<std::vector<double> >(num_cells);
    for (const auto& idx : index_ptrs) {
        const auto& curdex = idx->ptr();
        if (num_cells != curdex->num_observations()) {
            throw std::runtime_error("mismatch in number of cells between neighbor indices");
        }
        ndims.push_back(curdex->num_dimensions());
        distances.push_back(mumosa::compute_distance(*curdex, buffer.data(), opt));
    }

    auto scaling = mumosa::compute_scale(distances);
    if (use_weights) {
        const auto weights = js2int<std::uintptr_t>(weights_raw);
        auto weight_ptr = reinterpret_cast<const double*>(weights);
        for (I<decltype(nembed)> e = 0; e < nembed; ++e) {
            scaling[e] *= weight_ptr[e];
        }
    }

    // Interleaving the scaled embeddings.
    const auto combined = js2int<std::uintptr_t>(combined_raw);
    auto out_ptr = reinterpret_cast<double*>(combined);
    auto embed_ptrs = convert_array_of_offsets<const double*>(nembed, embeddings_raw);
    mumosa::combine_scaled_embeddings(ndims, num_cells, embed_ptrs, scaling, out_ptr);
}

EMSCRIPTEN_BINDINGS(scale_by_neighbors) {
    emscripten::function("scale_by_neighbors", &js_scale_by_neighbors, emscripten::return_value_policy::take_ownership());
}
