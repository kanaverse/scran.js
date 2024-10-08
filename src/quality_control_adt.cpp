#include <emscripten/bind.h>

#include "parallel.h"
#include "utils.h"
#include "NumericMatrix.h"

#include "scran/scran.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

struct PerCellAdtQcMetrics_Results {
    typedef scran::PerCellAdtQcMetrics::Results Store;

    Store store;

    PerCellAdtQcMetrics_Results(Store s) : store(std::move(s)) {}

public:
    emscripten::val sums() const {
        return emscripten::val(emscripten::typed_memory_view(store.sums.size(), store.sums.data()));
    }

    emscripten::val detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val subset_totals(int i) const {
        const auto& current = store.subset_totals[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    int num_subsets() const {
        return store.subset_totals.size();
    }

    int num_cells() const {
        return store.sums.size();
    }
};

PerCellAdtQcMetrics_Results per_cell_adt_qc_metrics(const NumericMatrix& mat, int nsubsets, uintptr_t subsets, int nthreads) {
    scran::PerCellAdtQcMetrics qc;
    qc.set_num_threads(nthreads);
    auto store = qc.run(mat.ptr.get(), convert_array_of_offsets<const uint8_t*>(nsubsets, subsets));
    return PerCellAdtQcMetrics_Results(std::move(store));
}

struct SuggestAdtQcFilters_Results {
    typedef scran::SuggestAdtQcFilters::Thresholds Store;

    SuggestAdtQcFilters_Results(Store s) : store(std::move(s)) {}

    Store store;

    SuggestAdtQcFilters_Results(int num_subsets, int num_blocks) {
        store.detected.resize(num_blocks);
        store.subset_totals.resize(num_subsets);
        for (int s = 0; s < num_subsets; ++s) {
            store.subset_totals[s].resize(num_blocks);
        }
    }

public:
    emscripten::val thresholds_detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val thresholds_subset_totals(int i) const {
        return emscripten::val(emscripten::typed_memory_view(store.subset_totals[i].size(), store.subset_totals[i].data()));
    }

    int num_subsets() const {
        return store.subset_totals.size();
    }

    int num_blocks() const {
        return store.detected.size();
    }

    void filter(uintptr_t metrics, bool use_blocks, uintptr_t blocks, uintptr_t output) const {
        const int32_t* bptr = NULL;
        if (use_blocks) {
            bptr = reinterpret_cast<const int32_t*>(blocks);
        }
        const auto& mstore = reinterpret_cast<const PerCellAdtQcMetrics_Results*>(metrics)->store;
        store.filter_blocked(mstore.sums.size(), bptr, mstore.buffers(), reinterpret_cast<uint8_t*>(output));
        return;
    }
};

SuggestAdtQcFilters_Results suggest_adt_qc_filters(uintptr_t metrics, bool use_blocks, uintptr_t blocks, double nmads, double min_drop) {
    scran::SuggestAdtQcFilters qc;
    qc.set_num_mads(nmads);
    qc.set_min_detected_drop(min_drop);

    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }
    auto thresholds = qc.run_blocked(reinterpret_cast<const PerCellAdtQcMetrics_Results*>(metrics)->store, bptr);
    return SuggestAdtQcFilters_Results(std::move(thresholds));
}

EMSCRIPTEN_BINDINGS(quality_control_adt) {
    emscripten::function("per_cell_adt_qc_metrics", &per_cell_adt_qc_metrics, emscripten::return_value_policy::take_ownership());

    emscripten::class_<PerCellAdtQcMetrics_Results>("PerCellAdtQcMetrics_Results")
        .function("sums", &PerCellAdtQcMetrics_Results::sums, emscripten::return_value_policy::take_ownership())
        .function("detected", &PerCellAdtQcMetrics_Results::detected, emscripten::return_value_policy::take_ownership())
        .function("subset_totals", &PerCellAdtQcMetrics_Results::subset_totals, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &PerCellAdtQcMetrics_Results::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_cells", &PerCellAdtQcMetrics_Results::num_cells, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("suggest_adt_qc_filters", &suggest_adt_qc_filters, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SuggestAdtQcFilters_Results>("SuggestAdtQcFilters_Results")
        .constructor<int, int>()
        .function("thresholds_detected", &SuggestAdtQcFilters_Results::thresholds_detected, emscripten::return_value_policy::take_ownership())
        .function("thresholds_subset_totals", &SuggestAdtQcFilters_Results::thresholds_subset_totals, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &SuggestAdtQcFilters_Results::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &SuggestAdtQcFilters_Results::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("filter", &SuggestAdtQcFilters_Results::filter, emscripten::return_value_policy::take_ownership())
        ;
}
