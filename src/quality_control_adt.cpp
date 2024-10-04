#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#include "scran_qc/scran_qc.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

struct ComputeAdtQcMetricsResults {
    typedef scran_qc::ComputeAdtQcMetricsResults<double, int> Store;

    Store store;

public:
    ComputeAdtQcMetricsResults(Store s) : store(std::move(s)) {}

public:
    emscripten::val sum() const {
        return emscripten::val(emscripten::typed_memory_view(store.sum.size(), store.sum.data()));
    }

    emscripten::val detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val subset_sum(int i) const {
        const auto& current = store.subset_sum[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    int num_subsets() const {
        return store.subset_sum.size();
    }

    int num_cells() const {
        return store.sum.size();
    }
};

ComputeAdtQcMetricsResults per_cell_adt_qc_metrics(const NumericMatrix& mat, int nsubsets, uintptr_t subsets, int nthreads) {
    scran_qc::ComputeAdtQcMetricsOptions opt;
    opt.num_threads = nthreads;
    auto store = scran_qc::compute_adt_qc_metrics(*(mat.ptr), convert_array_of_offsets<const uint8_t*>(nsubsets, subsets), opt);
    return ComputeAdtQcMetricsResults(std::move(store));
}

struct SuggestAdtQcFiltersResults {
    bool use_blocked = true;
    scran_qc::AdtQcFilters<double> store_unblocked;
    scran_qc::AdtQcBlockedFilters<double> store_blocked;

public:
    SuggestAdtQcFiltersResults(scran_qc::AdtQcFilters<double> store) : store_unblocked(std::move(store)), use_blocked(false) {}

    SuggestAdtQcFiltersResults(scran_qc::AdtQcBlockedFilters<double> store) : store_blocked(std::move(store)) {}

    SuggestAdtQcFiltersResults(int num_subsets, int num_blocks) {
        if (num_blocks <= 1) {
            use_blocked = false;
            store_unblocked.get_subset_sum().resize(num_subsets);
        } else {
            store_blocked.get_detected().resize(num_blocks);
            auto& ssum = store_blocked.get_subset_sum();
            ssum.resize(num_subsets);
            for (int s = 0; s < num_subsets; ++s) {
                ssum[s].resize(num_blocks);
            }
        }
    }

public:
    emscripten::val thresholds_detected() {
        if (use_blocked) {
            auto& det = store_blocked.get_detected();
            return emscripten::val(emscripten::typed_memory_view(det.size(), det.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& det = store_unblocked.get_detected();
            return emscripten::val(emscripten::typed_memory_view(1, &det));
        }
    }

    emscripten::val thresholds_subset_sum(int i) {
        if (use_blocked) {
            auto& ssum = store_blocked.get_subset_sum()[i];
            return emscripten::val(emscripten::typed_memory_view(ssum.size(), ssum.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& ssum = store_unblocked.get_subset_sum()[i];
            return emscripten::val(emscripten::typed_memory_view(1, &ssum));
        }
    }

public:
    int num_subsets() const {
        if (use_blocked) {
            return store_blocked.get_subset_sum().size();
        } else {
            return store_unblocked.get_subset_sum().size();
        }
    }

    int num_blocks() const {
        if (use_blocked) {
            return store_blocked.get_detected().size();
        } else {
            return 1;
        }
    }

    bool is_blocked() const {
        return use_blocked;
    }

    void filter(const ComputeAdtQcMetricsResults& metrics, uintptr_t blocks, uintptr_t output) const {
        auto optr = reinterpret_cast<uint8_t*>(output);
        if (use_blocked) {
            store_blocked.filter(metrics.store, reinterpret_cast<const int32_t*>(blocks), optr);
        } else {
            store_unblocked.filter(metrics.store, optr);
        }
        return;
    }
};

SuggestAdtQcFiltersResults suggest_adt_qc_filters(const ComputeAdtQcMetricsResults& metrics, bool use_blocks, uintptr_t blocks, double nmads, double min_drop) {
    scran_qc::ComputeAdtQcFiltersOptions opt;
    opt.detected_num_mads = nmads;
    opt.subset_sum_num_mads = nmads;
    opt.detected_min_drop = min_drop;

    if (use_blocks) {
        auto thresholds = scran_qc::compute_adt_qc_filters_blocked(metrics.store, reinterpret_cast<const int32_t*>(blocks), opt);
        return SuggestAdtQcFiltersResults(std::move(thresholds));
    } else {
        auto thresholds = scran_qc::compute_adt_qc_filters(metrics.store, opt);
        return SuggestAdtQcFiltersResults(std::move(thresholds));
    }
}

EMSCRIPTEN_BINDINGS(quality_control_adt) {
    emscripten::function("per_cell_adt_qc_metrics", &per_cell_adt_qc_metrics, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ComputeAdtQcMetricsResults>("ComputeAdtQcMetricsResults")
        .function("sum", &ComputeAdtQcMetricsResults::sum, emscripten::return_value_policy::take_ownership())
        .function("detected", &ComputeAdtQcMetricsResults::detected, emscripten::return_value_policy::take_ownership())
        .function("subset_sum", &ComputeAdtQcMetricsResults::subset_sum, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &ComputeAdtQcMetricsResults::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_cells", &ComputeAdtQcMetricsResults::num_cells, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("suggest_adt_qc_filters", &suggest_adt_qc_filters, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SuggestAdtQcFiltersResults>("SuggestAdtQcFiltersResults")
        .constructor<int, int>()
        .function("thresholds_detected", &SuggestAdtQcFiltersResults::thresholds_detected, emscripten::return_value_policy::take_ownership())
        .function("thresholds_subset_sum", &SuggestAdtQcFiltersResults::thresholds_subset_sum, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &SuggestAdtQcFiltersResults::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &SuggestAdtQcFiltersResults::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("is_blocked", &SuggestAdtQcFiltersResults::is_blocked, emscripten::return_value_policy::take_ownership())
        .function("filter", &SuggestAdtQcFiltersResults::filter, emscripten::return_value_policy::take_ownership())
        ;
}
