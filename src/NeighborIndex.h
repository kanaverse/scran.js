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
    std::shared_ptr<knncolle::Base<> > search;
    /**
     * @endcond
     */

    /** 
     * Bind a `NeighborIndex` to an existing object in the Wasm heap.
     *
     * @param offset Offset in the Wasm heap.
     */
    static NeighborIndex bind(uintptr_t offset) {
        return *reinterpret_cast<NeighborIndex*>(offset);
    }
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
    typedef std::vector<std::vector<std::pair<int, double> > > Neighbors;

    NeighborResults(size_t n) : neighbors(new Neighbors(n)) {}

    std::shared_ptr<Neighbors> neighbors;
    /**
     * @endcond
     */

    /** 
     * Bind a `NeighborResults` to an existing object in the Wasm heap.
     *
     * @param offset Offset in the Wasm heap.
     */
    static NeighborResults bind(uintptr_t offset) {
        return *reinterpret_cast<NeighborResults*>(offset);
    }
};

NeighborResults find_nearest_neighbors(const NeighborIndex&, int);

#endif
