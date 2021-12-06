#ifndef NEIGHBOR_INDEX_H
#define NEIGHBOR_INDEX_H

#include "knncolle/knncolle.hpp"
#include <memory>

/**
 * @brief Prebuilt nearest neighbor index.
 *
 * This index is intended to be built once and used for repeated searching in other functions,
 * e.g., `initialize_tsne_from_index()`, `initialize_umap_from_index()`.
 */
struct NeighborIndex {
    std::unique_ptr<knncolle::Base<> > search;
};

NeighborIndex build_neighbor_index(uintptr_t, int, int, bool);

#endif
