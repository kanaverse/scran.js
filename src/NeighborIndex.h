#ifndef NEIGHBOR_INDEX_H
#define NEIGHBOR_INDEX_H

#include "knncolle/knncolle.hpp"
#include <memory>
#include <vector>

/**
 * @brief Prebuilt nearest neighbor index.
 */
struct NeighborIndex {
    /**
     * @cond
     */
    std::unique_ptr<knncolle::Base<> > search;
    /**
     * @endcond
     */
};

NeighborIndex build_neighbor_index(uintptr_t, int, int, bool);

/**
 * @brief Nearest neighbor search results.
 *
 */
struct NeighborResults { 
    /**
     * @cond
     */
    NeighborResults(size_t n) : neighbors(n) {}
    std::vector<std::vector<std::pair<int, double> > > neighbors;
    /**
     * @endcond
     */
};

NeighborResults find_nearest_neighbors(const NeighborIndex&, int);

#endif
