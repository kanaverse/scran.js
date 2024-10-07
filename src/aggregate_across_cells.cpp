#include <emscripten/bind.h>

#include <cstdint>

#include "NumericMatrix.h"

#include "tatami_stats/tatami_stats.hpp"
#include "scran_aggregate/scran_aggregate.hpp"

struct AggregateAcrossCellsResults {
    int ngenes;
    scran_aggregate::AggregateAcrossCellsResults<double, double> store;

public:
    AggregateAcrossCellsResults(int ngenes, scran_aggregate::AggregateAcrossCellsResults<double, double> store) : ngenes(ngenes), store(std::move(store)) {}

public:
    int num_genes() const {
        return ngenes;
    }

    int num_groups() const {
        return store.sums.size();
    }

    emscripten::val group_sums(int i) const {
        return emscripten::val(emscripten::typed_memory_view(ngenes, store.sums[i].data()));
    }

    void all_sums(uintptr_t output) const {
        auto optr = reinterpret_cast<double*>(output);
        for (const auto& ss : store.sums) {
            std::copy_n(ss.begin(), ngenes, optr);
            optr += ngenes;
        }
    }

    emscripten::val group_detected(int i) const {
        return emscripten::val(emscripten::typed_memory_view(ngenes, store.detected[i].data()));
    }

    void all_detected(uintptr_t output) const {
        auto optr = reinterpret_cast<double*>(output);
        for (const auto& ds : store.detected) {
            std::copy_n(ds.begin(), ngenes, optr);
            optr += ngenes;
        }
    }
};

AggregateAcrossCellsResults aggregate_across_cells(const NumericMatrix& mat, uintptr_t factor, bool average, int nthreads) {
    scran_aggregate::AggregateAcrossCellsOptions aopt;
    auto fptr = reinterpret_cast<const int32_t*>(factor);
    auto store = scran_aggregate::aggregate_across_cells<double, double>(*(mat.ptr), fptr, aopt);

    if (average) {
        auto sizes = tatami_stats::tabulate_groups(fptr, mat.ptr->ncol());
        for (size_t i = 0, end = sizes.size(); i < end; ++i) {
            double denom = 1.0 / sizes[i];
            for (auto& x : store.sums[i]) {
                x *= denom;
            }
            for (auto& x : store.detected[i]) {
                x *= denom;
            }
        }
    }

    return AggregateAcrossCellsResults(mat.ptr->nrow(), std::move(store));
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
