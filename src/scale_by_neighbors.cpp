#include <emscripten/bind.h>
#include "NeighborIndex.h"
#include "parallel.h"
#include "scran/dimensionality_reduction/ScaleByNeighbors.hpp"
#include "utils.h"
#include <vector>

void scale_by_neighbors(int ncells, int nembed, uintptr_t embeddings, uintptr_t indices, uintptr_t combined, int num_neighbors, bool use_weights, uintptr_t weights) {
    auto index_ptrs = convert_array_of_offsets<const NeighborIndex*>(nembed, indices);

    scran::ScaleByNeighbors runner;
    runner.set_neighbors(num_neighbors);

    std::vector<std::pair<double, double> > distances(nembed);
    for (int e = 0; e < nembed; ++e) {
        distances[e] = runner.compute_distance((index_ptrs[e]->search).get());
    }

    auto scaling = scran::ScaleByNeighbors::compute_scale(distances);
    if (use_weights) {
        auto weight_ptr = reinterpret_cast<const double*>(weights);
        for (int e = 0; e < nembed; ++e) {
            scaling[e] *= weight_ptr[e];
        }
    }

    // Interleaving the scaled embeddings.
    std::vector<int> ndims(nembed);
    for (int e = 0; e < nembed; ++e) {
        const auto& index = (index_ptrs[e]->search);
        ndims[e] = index->ndim();
    }

    auto embed_ptrs = convert_array_of_offsets<const double*>(nembed, embeddings);
    auto out_ptr = reinterpret_cast<double*>(combined);
    scran::ScaleByNeighbors::combine_scaled_embeddings(ndims, ncells, embed_ptrs, scaling, out_ptr);
}

EMSCRIPTEN_BINDINGS(scale_by_neighbors) {
    emscripten::function("scale_by_neighbors", &scale_by_neighbors);
}

