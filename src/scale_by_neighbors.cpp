#include <emscripten/bind.h>

#include <vector>
#include <cstdint>
#include <cstddef>

#include "NeighborIndex.h"
#include "utils.h"

#include "mumosa/mumosa.hpp"

void scale_by_neighbors(
    JsFakeInt nembed_raw,
    std::uintptr_t embeddings,
    std::uintptr_t indices,
    std::uintptr_t combined,
    JsFakeInt num_neighbors,
    bool use_weights,
    std::uintptr_t weights,
    JsFakeInt nthreads_raw
) {
    const auto nembed = js2int<std::size_t>(nembed_raw);
    auto index_ptrs = convert_array_of_offsets<const NeighborIndex*>(nembed, indices);
    std::vector<const knncolle::Prebuilt<std::int32_t, double, double>*> actual_ptrs;
    std::vector<std::size_t> ndims;

    std::int32_t num_cells = (nembed ? index_ptrs.front()->index->num_observations() : 0);
    for (const auto& idx : index_ptrs) {
        if (num_cells != idx->index->num_observations()) {
            throw std::runtime_error("mismatch in number of cells between neighbor indices");
        }
        actual_ptrs.emplace_back((idx->index).get());
        ndims.push_back((idx->index)->num_dimensions());
    }

    mumosa::Options opt;
    opt.num_neighbors = num_neighbors;
    opt.num_threads = js2int<int>(nthreads_raw);

    std::vector<std::pair<double, double> > distances(nembed);
    auto buffer = sanisizer::create<std::vector<double> >(num_cells);
    for (I<decltype(nembed)> e = 0; e < nembed; ++e) {
        distances[e] = mumosa::compute_distance(*(index_ptrs[e]->index), buffer.data(), opt);
    }

    auto scaling = mumosa::compute_scale(distances);
    if (use_weights) {
        auto weight_ptr = reinterpret_cast<const double*>(weights);
        for (I<decltype(nembed)> e = 0; e < nembed; ++e) {
            scaling[e] *= weight_ptr[e];
        }
    }

    // Interleaving the scaled embeddings.
    auto out_ptr = reinterpret_cast<double*>(combined);
    auto embed_ptrs = convert_array_of_offsets<const double*>(nembed, embeddings);
    mumosa::combine_scaled_embeddings(ndims, num_cells, embed_ptrs, scaling, out_ptr);
}

EMSCRIPTEN_BINDINGS(scale_by_neighbors) {
    emscripten::function("scale_by_neighbors", &scale_by_neighbors, emscripten::return_value_policy::take_ownership());
}
