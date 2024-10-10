#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#include "scran_qc/scran_qc.hpp"

#include <cstdint>

struct ComputeRnaQcMetricsResults {
    typedef scran_qc::ComputeRnaQcMetricsResults<double, int32_t, double> Store;

    Store store;

public:
    ComputeRnaQcMetricsResults(Store s) : store(std::move(s)) {}

public:
    emscripten::val sum() const {
        return emscripten::val(emscripten::typed_memory_view(store.sum.size(), store.sum.data()));
    }

    emscripten::val detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val subset_proportion(int32_t i) const {
        const auto& current = store.subset_proportion[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    int32_t num_subsets() const {
        return store.subset_proportion.size();
    }

    int32_t num_cells() const {
        return store.sum.size();
    }
};

ComputeRnaQcMetricsResults compute_rna_qc_metrics(const NumericMatrix& mat, int32_t nsubsets, uintptr_t subsets, int32_t nthreads) {
    scran_qc::ComputeRnaQcMetricsOptions opt;
    opt.num_threads = nthreads;
    auto store = scran_qc::compute_rna_qc_metrics(*(mat.ptr), convert_array_of_offsets<const uint8_t*>(nsubsets, subsets), opt);
    return ComputeRnaQcMetricsResults(std::move(store));
}

struct SuggestRnaQcFiltersResults {
    bool use_blocked = true;
    scran_qc::RnaQcFilters<double> store_unblocked;
    scran_qc::RnaQcBlockedFilters<double> store_blocked;

public:
    SuggestRnaQcFiltersResults(scran_qc::RnaQcFilters<double> store) : store_unblocked(std::move(store)), use_blocked(false) {}

    SuggestRnaQcFiltersResults(scran_qc::RnaQcBlockedFilters<double> store) : store_blocked(std::move(store)) {}

    SuggestRnaQcFiltersResults(int32_t num_subsets, int32_t num_blocks) {
        if (num_blocks <= 1) {
            use_blocked = false;
            store_unblocked.get_subset_proportion().resize(num_subsets);
        } else {
            store_blocked.get_sum().resize(num_blocks);
            store_blocked.get_detected().resize(num_blocks);
            auto& sub = store_blocked.get_subset_proportion();
            sub.resize(num_subsets);
            for (int32_t s = 0; s < num_subsets; ++s) {
                sub[s].resize(num_blocks);
            }
        }
    }

public:
    emscripten::val thresholds_sum() {
        if (use_blocked) {
            auto& sum = store_blocked.get_sum();
            return emscripten::val(emscripten::typed_memory_view(sum.size(), sum.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& sum = store_unblocked.get_sum();
            return emscripten::val(emscripten::typed_memory_view(1, &sum));
        }
    }

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

    emscripten::val thresholds_subset_proportion(int32_t i) {
        if (use_blocked) {
            auto& current = store_blocked.get_subset_proportion()[i];
            return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& current = store_unblocked.get_subset_proportion()[i];
            return emscripten::val(emscripten::typed_memory_view(1, &current));
        }
    }

public:
    int32_t num_subsets() const {
        if (use_blocked) {
            return store_blocked.get_subset_proportion().size();
        } else {
            return store_unblocked.get_subset_proportion().size();
        }
    }

    int32_t num_blocks() const {
        if (use_blocked) {
            return store_blocked.get_sum().size();
        } else {
            return 1;
        }
    }

    bool is_blocked() const {
        return use_blocked;
    }

    void filter(const ComputeRnaQcMetricsResults& metrics, uintptr_t blocks, uintptr_t output) const {
        auto optr = reinterpret_cast<uint8_t*>(output);
        if (use_blocked) {
            store_blocked.filter(metrics.store, reinterpret_cast<const int32_t*>(blocks), optr);
        } else {
            store_unblocked.filter(metrics.store, optr);
        }
    }
};

SuggestRnaQcFiltersResults suggest_rna_qc_filters(const ComputeRnaQcMetricsResults& metrics, bool use_blocks, uintptr_t blocks, double nmads) {
    scran_qc::ComputeRnaQcFiltersOptions opt;
    opt.sum_num_mads = nmads;
    opt.detected_num_mads = nmads;
    opt.subset_proportion_num_mads = nmads;

    if (use_blocks) {
        auto thresholds = scran_qc::compute_rna_qc_filters_blocked(metrics.store, reinterpret_cast<const int32_t*>(blocks), opt);
        return SuggestRnaQcFiltersResults(std::move(thresholds));
    } else {
        auto thresholds = scran_qc::compute_rna_qc_filters(metrics.store, opt);
        return SuggestRnaQcFiltersResults(std::move(thresholds));
    }
}

EMSCRIPTEN_BINDINGS(quality_control_rna) {
    emscripten::function("compute_rna_qc_metrics", &compute_rna_qc_metrics, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ComputeRnaQcMetricsResults>("ComputeRnaQcMetricsResults")
        .function("sum", &ComputeRnaQcMetricsResults::sum, emscripten::return_value_policy::take_ownership())
        .function("detected", &ComputeRnaQcMetricsResults::detected, emscripten::return_value_policy::take_ownership())
        .function("subset_proportion", &ComputeRnaQcMetricsResults::subset_proportion, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &ComputeRnaQcMetricsResults::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_cells", &ComputeRnaQcMetricsResults::num_cells, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("suggest_rna_qc_filters", &suggest_rna_qc_filters, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SuggestRnaQcFiltersResults>("SuggestRnaQcFiltersResults")
        .constructor<int32_t, int32_t>()
        .function("thresholds_sum", &SuggestRnaQcFiltersResults::thresholds_sum, emscripten::return_value_policy::take_ownership())
        .function("thresholds_detected", &SuggestRnaQcFiltersResults::thresholds_detected, emscripten::return_value_policy::take_ownership())
        .function("thresholds_subset_proportion", &SuggestRnaQcFiltersResults::thresholds_subset_proportion, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &SuggestRnaQcFiltersResults::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &SuggestRnaQcFiltersResults::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("is_blocked", &SuggestRnaQcFiltersResults::is_blocked, emscripten::return_value_policy::take_ownership())
        .function("filter", &SuggestRnaQcFiltersResults::filter, emscripten::return_value_policy::take_ownership())
        ;
}
