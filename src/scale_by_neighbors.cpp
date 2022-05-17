#include <emscripten/bind.h>
#include "NeighborIndex.h"
#include "parallel.h"
#include "scran/dimensionality_reduction/ScaleByNeighbors.hpp"
#include "utils.h"
#include <vector>
#include <memory>

template<class Index>
void scale_by_neighbors_internal(
    const std::vector<int>& ndims,
    size_t ncells,
    const std::vector<const double*>& embeddings, 
    const std::vector<const Index*>& indices, 
    uintptr_t combined, 
    int num_neighbors, 
    bool use_weights, 
    uintptr_t weights) 
{
    scran::ScaleByNeighbors runner;
    runner.set_neighbors(num_neighbors);

    int nembed = ndims.size();
    std::vector<std::pair<double, double> > distances(nembed);
    for (int e = 0; e < nembed; ++e) {
        distances[e] = runner.compute_distance(indices[e]);
    }

    auto scaling = scran::ScaleByNeighbors::compute_scale(distances);
    if (use_weights) {
        auto weight_ptr = reinterpret_cast<const double*>(weights);
        for (int e = 0; e < nembed; ++e) {
            scaling[e] *= weight_ptr[e];
        }
    }

    // Interleaving the scaled embeddings.
    auto out_ptr = reinterpret_cast<double*>(combined);
    scran::ScaleByNeighbors::combine_scaled_embeddings(ndims, ncells, embeddings, scaling, out_ptr);
    return;
}

void scale_by_neighbors_indices(int ncells, int nembed, uintptr_t embeddings, uintptr_t indices, uintptr_t combined, int num_neighbors, bool use_weights, uintptr_t weights) {
    auto index_ptrs = convert_array_of_offsets<const NeighborIndex*>(nembed, indices);

    std::vector<const knncolle::Base<>*> actual_ptrs;
    std::vector<int> ndims;
    for (const auto& idx : index_ptrs) {
        actual_ptrs.emplace_back((idx->search).get());
        ndims.push_back((idx->search)->ndim());
    }

    auto embed_ptrs = convert_array_of_offsets<const double*>(nembed, embeddings);
    scale_by_neighbors_internal(ndims, ncells, embed_ptrs, actual_ptrs, combined, num_neighbors, use_weights, weights);
    return;
}

void scale_by_neighbors_matrices(int ncells, int nembed, uintptr_t ndims, uintptr_t embeddings, uintptr_t combined, int num_neighbors, bool use_weights, uintptr_t weights, bool approximate) {
    auto ndim_ptrs = reinterpret_cast<const int*>(ndims);
    auto embed_ptrs = convert_array_of_offsets<const double*>(nembed, embeddings);

    // Parallelize the index building.
    std::vector<std::unique_ptr<knncolle::Base<> > > indices(nembed);
    run_parallel(nembed, [&](size_t first, size_t last) -> void {
        for (size_t f = first; f < last; ++f) {
            auto ptr = embed_ptrs[f];
            auto nr = ndim_ptrs[f];
            if (approximate) {
                indices[f].reset(new knncolle::AnnoyEuclidean<>(nr, ncells, ptr));
            } else {
                indices[f].reset(new knncolle::VpTreeEuclidean<>(nr, ncells, ptr));
            }
        }
    });

    std::vector<const knncolle::Base<>*> actual_ptrs;
    for (const auto& idx : indices) {
        actual_ptrs.emplace_back(idx.get());
    }
    std::vector<int> ndims2(ndim_ptrs, ndim_ptrs + nembed);
    scale_by_neighbors_internal(ndims2, ncells, embed_ptrs, actual_ptrs, combined, num_neighbors, use_weights, weights);
    return;
}

EMSCRIPTEN_BINDINGS(scale_by_neighbors) {
    emscripten::function("scale_by_neighbors_matrices", &scale_by_neighbors_matrices);

    emscripten::function("scale_by_neighbors_indices", &scale_by_neighbors_indices);
}
