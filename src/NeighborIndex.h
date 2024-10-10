#ifndef NEIGHBOR_INDEX_H
#define NEIGHBOR_INDEX_H

#include <memory>
#include <vector>

#include "knncolle/knncolle.hpp"

struct NeighborIndex {
    std::unique_ptr<knncolle::Prebuilt<int32_t, int32_t, double> > index;

    size_t num_obs() const {
        return index->num_observations();
    }

    size_t num_dim() const {
        return index->num_dimensions();
    }
};

std::unique_ptr<knncolle::Builder<knncolle::SimpleMatrix<int32_t, int32_t, double>, double> > create_builder(bool);

NeighborIndex build_neighbor_index(uintptr_t, int32_t, int32_t, bool);

struct NeighborResults { 
    typedef std::vector<std::vector<std::pair<int32_t, double> > > Neighbors;

    Neighbors neighbors;

public:
    NeighborResults(size_t n = 0) : neighbors(n) {}

    NeighborResults(size_t n, uintptr_t runs, uintptr_t indices, uintptr_t distances) : neighbors(n) {
        auto rptr = reinterpret_cast<const int32_t*>(runs);
        auto iptr = reinterpret_cast<const int32_t*>(indices);
        auto dptr = reinterpret_cast<const double*>(distances);

        for (size_t i = 0; i < n; ++i) {
            neighbors[i].reserve(rptr[i]);
            for (int32_t j = 0; j < rptr[i]; ++j, ++iptr, ++dptr) {
                neighbors[i].emplace_back(*iptr, *dptr);
            }
        }
    }

public:
    size_t size() const {
        size_t out = 0;
        for (const auto& current : neighbors) {
            out += current.size();
        }
        return out;
    }

    size_t num_obs() const {
        return neighbors.size();
    }

    void serialize(uintptr_t runs, uintptr_t indices, uintptr_t distances) const {
        auto rptr = reinterpret_cast<int32_t*>(runs);
        auto iptr = reinterpret_cast<int32_t*>(indices);
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
    }
};

NeighborResults find_nearest_neighbors(const NeighborIndex&, int32_t, int32_t);

#endif
