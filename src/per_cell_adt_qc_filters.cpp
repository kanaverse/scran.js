#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "PerCellAdtQcMetrics_Results.h"

#include "scran/quality_control/PerCellAdtQcFilters.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

/**
 * @file per_cell_qc_filters.cpp
 *
 * @brief Define filters on the QC metrics to remove low-quality cells.
 */

/**
 * @brief Javascript-visible wrapper around `scran::PerCellAdtQcFilters::Results`.
 */
struct PerCellAdtQcFilters_Results {
    /** 
     * @cond
     */
    typedef scran::PerCellAdtQcFilters::Results<> Store;

    PerCellAdtQcFilters_Results(Store s) : store(std::move(s)) {}

    Store store;
    /** 
     * @endcond
     */

    /**
     * @return `UInt8Array` view specifying whether a cell was discarded because its number of detected features were too low.
     */
    emscripten::val discard_detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.filter_by_detected.size(), store.filter_by_detected.data()));
    }

    /**
     * @param i Index of the feature subset of interest.
     * @return `UInt8Array` view specifying whether a cell was discarded because its proportion of counts in subset `i` was too high.
     */
    emscripten::val discard_subset_totals(int i) const {
        const auto& current = store.filter_by_subset_totals[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    /**
     * @return `UInt8Array` view specifying whether a cell was discarded for any reason.
     */
    emscripten::val discard_overall() const {
        return emscripten::val(emscripten::typed_memory_view(store.overall_filter.size(), store.overall_filter.data()));
    }

    /**
     * @return `Float64Array` view containing the threshold applied on the number of detected genes (possibly for each block).
     */
    emscripten::val thresholds_detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.thresholds.detected.size(), store.thresholds.detected.data()));
    }

    /**
     * @param i Index of the feature subset of interest.
     * @return `Float64Array` view containing the threshold applied on the subset proportions for subset `i` (possibly for each block).
     */
    emscripten::val thresholds_subset_totals(int i) const {
        return emscripten::val(emscripten::typed_memory_view(store.thresholds.subset_totals[i].size(), store.thresholds.subset_totals[i].data()));
    }

    /**
     * @return Number of feature subsets for which proportion filters were computed.
     */
    int num_subsets() const {
        return store.thresholds.subset_totals.size();
    }
};

PerCellAdtQcFilters_Results per_cell_adt_qc_filters(PerCellAdtQcMetrics_Results& metrics, bool use_blocks, uintptr_t blocks, double nmads, double min_drop) {
    scran::PerCellAdtQcFilters qc;
    qc.set_nmads(nmads).set_min_detected_drop(min_drop);

    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    auto thresholds = qc.run_blocked(metrics.store, bptr);
    return PerCellAdtQcFilters_Results(std::move(thresholds));
}

EMSCRIPTEN_BINDINGS(per_cell_adt_qc_filters) {
    emscripten::function("per_cell_adt_qc_filters", &per_cell_adt_qc_filters);

    emscripten::class_<PerCellAdtQcFilters_Results>("PerCellAdtQcFilters_Results")
        .function("thresholds_detected", &PerCellAdtQcFilters_Results::thresholds_detected)
        .function("thresholds_subset_totals", &PerCellAdtQcFilters_Results::thresholds_subset_totals)
        .function("discard_detected", &PerCellAdtQcFilters_Results::discard_detected)
        .function("discard_subset_totals", &PerCellAdtQcFilters_Results::discard_subset_totals)
        .function("discard_overall", &PerCellAdtQcFilters_Results::discard_overall)
        .function("num_subsets", &PerCellAdtQcFilters_Results::num_subsets)
        ;
}
