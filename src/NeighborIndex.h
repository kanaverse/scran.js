#ifndef NEIGHBOR_INDEX_H
#define NEIGHBOR_INDEX_H

#include <memory>
#include <algorithm>
#include <vector>

#include "utils.h"

#include "knncolle/knncolle.hpp"

struct NeighborIndex {
    std::unique_ptr<knncolle::Prebuilt<std::int32_t, double, double> > index;

    JsFakeInt js_num_obs() const {
        return int2js(index->num_observations());
    }

    JsFakeInt js_num_dim() const {
        return int2js(index->num_dimensions());
    }
};

std::unique_ptr<knncolle::Builder<std::int32_t, double, double, knncolle::SimpleMatrix<std::int32_t, double> > > create_builder(bool);

class NeighborResults { 
    typedef std::vector<std::vector<std::pair<std::int32_t, double> > > Neighbors;

    Neighbors my_neighbors;

public:
    NeighborResults() = default;

    NeighborResults(Neighbors neighbors) : my_neighbors(std::move(neighbors)) {}

    NeighborResults(JsFakeInt n_raw, JsFakeInt runs_raw, JsFakeInt indices_raw, JsFakeInt distances_raw) : 
        my_neighbors(js2int<I<decltype(my_neighbors.size())> >(n_raw))
    {
        const auto runs = js2int<std::uintptr_t>(runs_raw);
        auto rptr = reinterpret_cast<const std::int32_t*>(runs);

        const auto indices = js2int<std::uintptr_t>(indices_raw);
        auto iptr = reinterpret_cast<const std::int32_t*>(indices);

        const auto distances = js2int<std::uintptr_t>(distances_raw);
        auto dptr = reinterpret_cast<const double*>(distances);

        const auto n = my_neighbors.size();
        for (I<decltype(n)> i = 0; i < n; ++i) {
            const auto run = rptr[i];
            auto& nn = my_neighbors[i];
            nn.reserve(run);

            for (I<decltype(run)> j = 0; j < run; ++j) {
                nn.emplace_back(iptr[j], dptr[j]);
            }

            iptr += run;
            dptr += run;
        }
    }

public:
    Neighbors& neighbors() {
        return my_neighbors;
    }

    const Neighbors& neighbors() const {
        return my_neighbors;
    }

public:
    JsFakeInt js_size(JsFakeInt truncate_raw) const {
        std::size_t out = 0;
        if (truncate_raw < 0) {
            for (const auto& current : my_neighbors) {
                out = sanisizer::sum<std::size_t>(out, current.size());
            }
        } else {
            const auto truncate = js2int<std::size_t>(truncate_raw);
            for (const auto& current : my_neighbors) {
                out = sanisizer::sum<std::size_t>(out, sanisizer::min(truncate, current.size()));
            }
        }
        return int2js(out);
    }

    JsFakeInt js_num_obs() const {
        return int2js(my_neighbors.size());
    }

    JsFakeInt js_num_neighbors() const {
        return int2js(my_neighbors.empty() ? 0 : my_neighbors.front().size());
    }

    void js_serialize(JsFakeInt runs_raw, JsFakeInt indices_raw, JsFakeInt distances_raw, JsFakeInt truncate_raw) const {
        const auto runs = js2int<std::uintptr_t>(runs_raw);
        auto rptr = reinterpret_cast<int32_t*>(runs);

        const auto indices = js2int<std::uintptr_t>(indices_raw);
        auto iptr = reinterpret_cast<int32_t*>(indices);

        const auto distances = js2int<std::uintptr_t>(distances_raw);
        auto dptr = reinterpret_cast<double*>(distances);

        const bool do_truncate = truncate_raw >= 0;
        const auto truncate = (do_truncate ? js2int<std::size_t>(truncate_raw) : 0);

        for (const auto& current : my_neighbors) {
            auto nkeep = current.size();
            if (do_truncate && truncate < nkeep) {
                nkeep = truncate;
            }
            *rptr = nkeep;
            ++rptr;

            for (I<decltype(nkeep)> i = 0; i < nkeep; ++i) {
                const auto& x = current[i];
                iptr[i] = x.first;
                dptr[i] = x.second;
            }

            iptr += nkeep;
            dptr += nkeep;
        }
    }
};

#endif
