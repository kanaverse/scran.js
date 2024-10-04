#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#include "scran_qc/scran_qc.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

struct ComputeRnaQcMetricsResults {
    typedef scran_qc::ComputeRnaQcMetricsResults<double, int, double> Store;

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

    emscripten::val subset_proportion(int i) const {
        const auto& current = store.subset_proportion[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    int num_subsets() const {
        return store.subset_proportion.size();
    }

    int num_cells() const {
        return store.sum.size();
    }
};

ComputeRnaQcMetricsResults compute_rna_qc_metrics(const NumericMatrix& mat, int nsubsets, uintptr_t subsets, int nthreads) {
    scran_qc::ComputeRnaQcMetricsOptions opt;
    opt.num_threads = nthreads;
    auto store = scran_qc::compute_rna_qc_metrics(*(mat.ptr), convert_array_of_offsets<const uint8_t*>(nsubsets, subsets), opt);
    return ComputeRnaQcMetricsResults(std::move(store));
}

struct SuggestRnaQcFiltersResults {
    scran_qc::RnaQcBlockedFilters<double> store;

public:
    SuggestRnaQcFiltersResults(scran_qc::RnaQcBlockedFilters<double> store) : store(std::move(store)) {}

    SuggestRnaQcFiltersResults(int num_subsets, int num_blocks) {
        store.get_sum().resize(num_blocks);
        store.get_detected().resize(num_blocks);
        store.get_subset_proportion().resize(num_subsets);
        for (int s = 0; s < num_subsets; ++s) {
            store.get_subset_proportion()[s].resize(num_blocks);
        }
    }

public:
    emscripten::val thresholds_sum() const {
        const auto& sum = store.get_sum();
        return emscripten::val(emscripten::typed_memory_view(sum.size(), sum.data()));
    }

    emscripten::val thresholds_detected() const {
        const auto& det = store.get_detected();
        return emscripten::val(emscripten::typed_memory_view(det.size(), det.data()));
    }

    emscripten::val thresholds_subset_proportion(int i) const {
        const auto& current = store.get_subset_proportion()[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    int num_subsets() const {
        return store.get_subset_proportion().size();
    }

    int num_blocks() const {
        return store.get_sum().size();
    }

    void filter(const ComputeRnaQcMetricsResults& metrics, const int32_t* blocks, uint8_t* output) const {
        store.filter(metrics.store, blocks, output);
        return;
    }
};

SuggestRnaQcFiltersResults suggest_rna_qc_filters(const ComputeRnaQcMetricsResults& metrics, bool use_blocks, const int32_t* blocks, double nmads) {
    scran_qc::ComputeRnaQcFiltersOptions opt;
    opt.sum_num_mads = nmads;
    opt.detected_num_mads = nmads;
    opt.subset_proportion_num_mads = nmads;

    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    auto thresholds = scran_qc::compute_rna_qc_filters_blocked(metrics.store, bptr, opt);
    return SuggestRnaQcFiltersResults(std::move(thresholds));
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
        .constructor<int, int>()
        .function("thresholds_sum", &SuggestRnaQcFiltersResults::thresholds_sum, emscripten::return_value_policy::take_ownership())
        .function("thresholds_detected", &SuggestRnaQcFiltersResults::thresholds_detected, emscripten::return_value_policy::take_ownership())
        .function("thresholds_subset_proportion", &SuggestRnaQcFiltersResults::thresholds_subset_proportion, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &SuggestRnaQcFiltersResults::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &SuggestRnaQcFiltersResults::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("filter", &SuggestRnaQcFiltersResults::filter, emscripten::return_value_policy::take_ownership())
        .function("filter_blocked", &SuggestRnaQcFiltersResults::filter, emscripten::return_value_policy::take_ownership())
        ;
}
