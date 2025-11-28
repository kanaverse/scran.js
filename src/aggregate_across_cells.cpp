#include <emscripten/bind.h>

#include <cstdint>

#include "NumericMatrix.h"

#include "tatami_stats/tatami_stats.hpp"
#include "scran_aggregate/scran_aggregate.hpp"

class AggregateAcrossCellsResults {
    std::int32_t my_ngenes;
    scran_aggregate::AggregateAcrossCellsResults<double, double> my_store;

public:
    AggregateAcrossCellsResults(std::int32_t ngenes, scran_aggregate::AggregateAcrossCellsResults<double, double> store) : 
        my_ngenes(ngenes), my_store(std::move(store))
    {}

public:
    JsFakeInt num_genes() const {
        return int2js(my_ngenes);
    }

    JsFakeInt num_groups() const {
        return int2js(my_store.sums.size());
    }

    emscripten::val group_sums(JsFakeInt i_raw) const {
        const auto i = js2int<std::size_t>(i_raw);
        return emscripten::val(emscripten::typed_memory_view(my_ngenes, my_store.sums[i].data()));
    }

    void all_sums(JsFakeInt output_raw) const {
        auto optr = reinterpret_cast<double*>(js2int<std::uintptr_t>(output_raw));
        for (const auto& ss : my_store.sums) {
            std::copy_n(ss.begin(), my_ngenes, optr);
            optr += my_ngenes;
        }
    }

    emscripten::val group_detected(JsFakeInt i_raw) const {
        const auto i = js2int<std::size_t>(i_raw);
        return emscripten::val(emscripten::typed_memory_view(my_ngenes, my_store.detected[i].data()));
    }

    void all_detected(JsFakeInt output_raw) const {
        auto optr = reinterpret_cast<double*>(js2int<std::uintptr_t>(output_raw));
        for (const auto& ds : my_store.detected) {
            std::copy_n(ds.begin(), my_ngenes, optr);
            optr += my_ngenes;
        }
    }
};

AggregateAcrossCellsResults aggregate_across_cells(const NumericMatrix& mat, JsFakeInt factor_raw, bool average, JsFakeInt nthreads_raw) {
    scran_aggregate::AggregateAcrossCellsOptions aopt;
    aopt.num_threads = js2int<int>(nthreads_raw);
    auto fptr = reinterpret_cast<const std::int32_t*>(js2int<std::uintptr_t>(factor_raw));
    auto store = scran_aggregate::aggregate_across_cells<double, double>(*mat, fptr, aopt);

    if (average) {
        auto sizes = tatami_stats::tabulate_groups(fptr, mat.ncol());
        const auto ngroups = sizes.size();
        for (I<decltype(ngroups)> i = 0; i < ngroups; ++i) {
            double denom = 1.0 / sizes[i];
            for (auto& x : store.sums[i]) {
                x *= denom;
            }
            for (auto& x : store.detected[i]) {
                x *= denom;
            }
        }
    }

    return AggregateAcrossCellsResults(mat.nrow(), std::move(store));
}

EMSCRIPTEN_BINDINGS(aggregate_across_cells) {
    emscripten::function("aggregate_across_cells", &aggregate_across_cells, emscripten::return_value_policy::take_ownership());

    emscripten::class_<AggregateAcrossCellsResults>("AggregateAcrossCellsResults")
        .function("group_sums", &AggregateAcrossCellsResults::group_sums, emscripten::return_value_policy::take_ownership())
        .function("all_sums", &AggregateAcrossCellsResults::all_sums, emscripten::return_value_policy::take_ownership())
        .function("group_detected", &AggregateAcrossCellsResults::group_detected, emscripten::return_value_policy::take_ownership())
        .function("all_detected", &AggregateAcrossCellsResults::all_detected, emscripten::return_value_policy::take_ownership())
        .function("num_genes", &AggregateAcrossCellsResults::num_genes, emscripten::return_value_policy::take_ownership())
        .function("num_groups", &AggregateAcrossCellsResults::num_groups, emscripten::return_value_policy::take_ownership())
        ;
}
