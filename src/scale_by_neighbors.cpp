#include <emscripten/bind.h>

#include <vector>

#include "NeighborIndex.h"
#include "utils.h"

#include "mumosa/mumosa.hpp"

void scale_by_neighbors(int ncells, int nembed, uintptr_t embeddings, uintptr_t indices, uintptr_t combined, int num_neighbors, bool use_weights, uintptr_t weights, int nthreads) {
    auto index_ptrs = convert_array_of_offsets<const NeighborIndex*>(nembed, indices);
    std::vector<const knncolle::Prebuilt<int, int, double>*> actual_ptrs;
    std::vector<int> ndims;
    for (const auto& idx : index_ptrs) {
        actual_ptrs.emplace_back((idx->index).get());
        ndims.push_back((idx->index)->num_dimensions());
    }

    mumosa::Options opt;
    opt.num_neighbors = num_neighbors;
    opt.num_threads = nthreads;

    std::vector<std::pair<double, double> > distances(nembed);
    for (int e = 0; e < nembed; ++e) {
        distances[e] = mumosa::compute_distance(*(index_ptrs[e]->index), opt);
    }

    auto scaling = mumosa::compute_scale(distances);
    if (use_weights) {
        auto weight_ptr = reinterpret_cast<const double*>(weights);
        for (int e = 0; e < nembed; ++e) {
            scaling[e] *= weight_ptr[e];
        }
    }

    // Interleaving the scaled embeddings.
    auto out_ptr = reinterpret_cast<double*>(combined);
    auto embed_ptrs = convert_array_of_offsets<const double*>(nembed, embeddings);
    mumosa::combine_scaled_embeddings(ndims, ncells, embed_ptrs, scaling, out_ptr);
}

EMSCRIPTEN_BINDINGS(scale_by_neighbors) {
    emscripten::function("scale_by_neighbors", &scale_by_neighbors, emscripten::return_value_policy::take_ownership());
}
