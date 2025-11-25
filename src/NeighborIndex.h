#ifndef NEIGHBOR_INDEX_H
#define NEIGHBOR_INDEX_H

#include <memory>
#include <algorithm>
#include <vector>

#include "knncolle/knncolle.hpp"

struct NeighborIndex {
    std::unique_ptr<knncolle::Prebuilt<int32_t, int32_t, double> > index;

    double num_obs() const {
        return static_cast<double>(index->num_observations());
    }

    double num_dim() const {
        return static_cast<double>(index->num_dimensions());
    }
};

std::unique_ptr<knncolle::Builder<knncolle::SimpleMatrix<int32_t, int32_t, double>, double> > create_builder(bool);

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
    double size(int32_t truncate) const {
        size_t out = 0;
        size_t long_truncate = truncate;
        for (const auto& current : neighbors) {
            out += std::min(long_truncate, current.size());
        }
        return static_cast<double>(out);
    }

    double num_obs() const {
        return static_cast<double>(neighbors.size());
    }

    double num_neighbors() const {
        return (neighbors.empty() ? 0 : neighbors.front().size());
    }

    void serialize(uintptr_t runs, uintptr_t indices, uintptr_t distances, int32_t truncate) const {
        auto rptr = reinterpret_cast<int32_t*>(runs);
        auto iptr = reinterpret_cast<int32_t*>(indices);
        auto dptr = reinterpret_cast<double*>(distances);

        size_t long_truncate = truncate;
        for (const auto& current : neighbors) {
            size_t nkeep = std::min(long_truncate, current.size());
            *rptr = nkeep;
            ++rptr;

            for (int32_t i = 0; i < nkeep; ++i) {
                const auto& x = current[i];
                *iptr = x.first;
                *dptr = x.second;
                ++iptr;
                ++dptr;
            }
        }
    }
};

#endif
