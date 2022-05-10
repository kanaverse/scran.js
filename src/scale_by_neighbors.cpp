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

    // Use the first entry with a non-zero RMSD as the reference.
    int ref = -1;
    for (int e = 0; e < nembed; ++e) {
        if (distances[e].second) {
            ref = e;
            break;
        }
    }

    std::vector<double> scaling(nembed);
    if (ref >= 0) {
        for (int e = 0; e < nembed; ++e) {
            if (e == ref) {
                scaling[e] = 1;
            } else {
                scaling[e] = runner.compute_scale(distances[ref], distances[e]);
            }
        }
    }

    if (use_weights) {
        auto weight_ptr = reinterpret_cast<const double*>(weights);
        for (int e = 0; e < nembed; ++e) {
            scaling[e] *= weight_ptr[e];
        }
    }

    // Interleaving the scaled embeddings.
    size_t ntotal = 0;
    for (int e = 0; e < nembed; ++e) {
        const auto& index = (index_ptrs[e]->search);
        ntotal += index->ndim();
    }

    auto embed_ptrs = convert_array_of_offsets<const double*>(nembed, embeddings);
    auto out_ptr = reinterpret_cast<double*>(combined);
    size_t offset = 0;

    for (int e = 0; e < nembed; ++e) {
        const auto& index = (index_ptrs[e]->search);
        size_t curdim = index->ndim();
        auto input = embed_ptrs[e];
        auto output = out_ptr + offset;
        auto s = scaling[e];

        for (size_t c = 0; c < ncells; ++c, input += curdim, output += ntotal) {
            for (size_t d = 0; d < curdim; ++d) {
                output[d] = input[d] * s;
            }
        }

        offset += curdim;
    }
}

EMSCRIPTEN_BINDINGS(scale_by_neighbors) {
    emscripten::function("scale_by_neighbors", &scale_by_neighbors);
}

