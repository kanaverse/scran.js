#include <emscripten/bind.h>

#include "parallel.h"
#include "utils.h"
#include "NumericMatrix.h"

#include "scran/scran.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

struct ComputeAdtQcMetricsResults {
    typedef scran_qc::ComputeAdtQcMetricsResults<int, int, double> Store;

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
    auto store = scran_qc::compute_adt_qc_metrics(*(mat.ptr), convert_array_of_offsets<const uint8_t*>(nsubsets, subsets));
    return ComputeAdtQcMetricsResults(std::move(store));
}

struct AdtQcFilters {
    scran_qc::AdtQcBlockedFilters<double> store;

public:
    AdtQcFilters(scran_qc::AdtQcBlockedFilters<double> store) : store(std::move(store)) {}

    AdtQcFilters(int num_subsets, int num_blocks) {
        store.detected.resize(num_blocks);
        store.subset_sum.resize(num_subsets);
        for (int s = 0; s < num_subsets; ++s) {
            store.subset_sum[s].resize(num_blocks);
        }
    }

public:
    emscripten::val thresholds_detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val thresholds_subset_sum(int i) const {
        return emscripten::val(emscripten::typed_memory_view(store.subset_sum[i].size(), store.subset_sum[i].data()));
    }

    int num_subsets() const {
        return store.subset_sum.size();
    }

    int num_blocks() const {
        return store.detected.size();
    }

    void filter(uintptr_t metrics, bool use_blocks, uintptr_t blocks, uintptr_t output) const {
        const int32_t* bptr = NULL;
        if (use_blocks) {
            bptr = reinterpret_cast<const int32_t*>(blocks);
        }
        const auto& mstore = reinterpret_cast<const ComputeAdtQcMetricsResults*>(metrics)->store;
        store.filter_blocked(mstore.sum.size(), bptr, mstore.buffers(), reinterpret_cast<uint8_t*>(output));
        return;
    }
};

AdtQcFilters suggest_adt_qc_filters(uintptr_t metrics, bool use_blocks, uintptr_t blocks, double nmads, double min_drop) {
    scran::SuggestAdtQcFilters qc;
    qc.set_num_mads(nmads);
    qc.set_min_detected_drop(min_drop);

    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }
    auto thresholds = qc.run_blocked(reinterpret_cast<const ComputeAdtQcMetricsResults*>(metrics)->store, bptr);
    return AdtQcFilters(std::move(thresholds));
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

    emscripten::class_<AdtQcFilters>("AdtQcFilters")
        .constructor<int, int>()
        .function("thresholds_detected", &AdtQcFilters::thresholds_detected, emscripten::return_value_policy::take_ownership())
        .function("thresholds_subset_sum", &AdtQcFilters::thresholds_subset_sum, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &AdtQcFilters::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &AdtQcFilters::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("filter", &AdtQcFilters::filter, emscripten::return_value_policy::take_ownership())
        ;
}
