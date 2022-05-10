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
     * @return Number of observations in the dataset.
     */
    size_t num_obs() const {
        return search->nobs();
    }

    /**
     * @return Number of dimensions in the dataset.
     */
    size_t num_dim() const {
        return search->ndim();
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

    NeighborResults(size_t n) : neighbors(n) {}

    Neighbors neighbors;
    /**
     * @endcond
     */

    /**
     * @return The size of the neighbor search results, i.e., the total number of neighbors across all observations.
     */
    size_t size() const {
        size_t out = 0;
        for (const auto& current : neighbors) {
            out += current.size();
        }
        return out;
    }

    /**
     * @return The number of observations.
     */
    size_t num_obs() const {
        return neighbors.size();
    }

    /**
     * Serialize the neighbor search results, usually for transmission to other memory spaces.
     * 
     * @param[out] runs Offset to an integer array of length equal to the number of observations. 
     * @param[out] indices Offset to an integer array of length equal to the number of neighbors across all observations (i.e., `size()`).
     * @param[out] distances Offset to a double-precision array of length equal to the number of neighbors across all observations.
     *
     * @return `runs` is filled with the number of neighbors per observation.
     * `indices` is filled with the identity of the neighbor indices for each observation, while `distances` is filled with their distances.
     * Note that these two arrays are filled contiguously for successive observations.
     */
    void serialize(uintptr_t runs, uintptr_t indices, uintptr_t distances) const {
        auto rptr = reinterpret_cast<int*>(runs);
        auto iptr = reinterpret_cast<int*>(indices);
        auto dptr = reinterpret_cast<double*>(distances);

        for (const auto& current : neighbors) {
            *rptr = current.size();
            ++rptr;

            for (const auto& x : current) {
                *iptr = x.first;
                *dptr = x.second;
                ++iptr;
                ++dptr;
            }
        }

        return;
    }

    /**
     * Manually reconstruct the nearest neighbor search results, usually from a separate memory space.
     * 
     * @param n Number of observations.
     * @param[in] runs Offset to an integer array of length equal to the number of observations,
     * containing the number of neighbors for each observation.
     * @param[in] indices Offset to an integer array of length equal to the number of neighbors across all observations (i.e., `size()`).
     * This contains the indices of the neighbors for each observation.
     * @param[in] distances Offset to a double-precision array of length equal to the number of neighbors across all observations.
     * This contains the distances to the neighbors for each observation.
     */
    NeighborResults(size_t n, uintptr_t runs, uintptr_t indices, uintptr_t distances) : neighbors(n) {
        auto rptr = reinterpret_cast<const int*>(runs);
        auto iptr = reinterpret_cast<const int*>(indices);
        auto dptr = reinterpret_cast<const double*>(distances);

        for (size_t i = 0; i < n; ++i) {
            neighbors[i].reserve(rptr[i]);
            for (int j = 0; j < rptr[i]; ++j, ++iptr, ++dptr) {
                neighbors[i].emplace_back(*iptr, *dptr);
            }
        }
    }
};

NeighborResults find_nearest_neighbors(const NeighborIndex&, int);

#endif
