#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#include "scran_qc/scran_qc.hpp"

#include <cstdint>

class ComputeAdtQcMetricsResults {
private:
    typedef scran_qc::ComputeAdtQcMetricsResults<double, std::int32_t> Store;

    Store my_store;

public:
    ComputeAdtQcMetricsResults(Store s) : my_store(std::move(s)) {}

    const Store& store() const {
        return my_store;
    }

public:
    emscripten::val js_sum() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.sum.size(), my_store.sum.data()));
    }

    emscripten::val js_detected() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.detected.size(), my_store.detected.data()));
    }

    emscripten::val js_subset_sum(JsFakeInt i_raw) const {
        const auto i = js2int<std::size_t>(i_raw);
        const auto& current = my_store.subset_sum[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    JsFakeInt js_num_subsets() const {
        return int2js(my_store.subset_sum.size());
    }

    JsFakeInt js_num_cells() const {
        return int2js(my_store.sum.size());
    }
};

ComputeAdtQcMetricsResults js_per_cell_adt_qc_metrics(const NumericMatrix& mat, JsFakeInt nsubsets_raw, JsFakeInt subsets_raw, JsFakeInt nthreads_raw) {
    scran_qc::ComputeAdtQcMetricsOptions opt;
    opt.num_threads = js2int<int>(nthreads_raw);
    auto store = scran_qc::compute_adt_qc_metrics(*mat, convert_array_of_offsets<const std::uint8_t*>(nsubsets_raw, subsets_raw), opt);
    return ComputeAdtQcMetricsResults(std::move(store));
}

class SuggestAdtQcFiltersResults {
private:
    bool my_use_blocked = true;
    scran_qc::AdtQcFilters<double> my_store_unblocked;
    scran_qc::AdtQcBlockedFilters<double> my_store_blocked;

public:
    SuggestAdtQcFiltersResults(scran_qc::AdtQcFilters<double> store) : my_use_blocked(false), my_store_unblocked(std::move(store)) {}

    SuggestAdtQcFiltersResults(scran_qc::AdtQcBlockedFilters<double> store) : my_store_blocked(std::move(store)) {}

    SuggestAdtQcFiltersResults(JsFakeInt num_subsets_raw, JsFakeInt num_blocks_raw) {
        const auto num_subsets = js2int<std::size_t>(num_subsets_raw);
        const auto num_blocks = js2int<std::size_t>(num_blocks_raw);

        if (num_blocks <= 1) {
            my_use_blocked = false;
            sanisizer::resize(my_store_unblocked.get_subset_sum(), num_subsets);
        } else {
            sanisizer::resize(my_store_blocked.get_detected(), num_blocks);
            auto& subsum = my_store_blocked.get_subset_sum();
            sanisizer::resize(subsum, num_subsets);
            for (I<decltype(num_subsets)> s = 0; s < num_subsets; ++s) {
                sanisizer::resize(subsum[s], num_blocks);
            }
        }
    }

public:
    emscripten::val js_detected() {
        if (my_use_blocked) {
            auto& det = my_store_blocked.get_detected();
            return emscripten::val(emscripten::typed_memory_view(det.size(), det.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& det = my_store_unblocked.get_detected();
            return emscripten::val(emscripten::typed_memory_view(1, &det));
        }
    }

    emscripten::val js_subset_sum(JsFakeInt i_raw) {
        const auto i = js2int<std::size_t>(i_raw);
        if (my_use_blocked) {
            auto& ssum = my_store_blocked.get_subset_sum()[i];
            return emscripten::val(emscripten::typed_memory_view(ssum.size(), ssum.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& ssum = my_store_unblocked.get_subset_sum()[i];
            return emscripten::val(emscripten::typed_memory_view(1, &ssum));
        }
    }

public:
    JsFakeInt js_num_subsets() const {
        if (my_use_blocked) {
            return int2js(my_store_blocked.get_subset_sum().size());
        } else {
            return int2js(my_store_unblocked.get_subset_sum().size());
        }
    }

    JsFakeInt js_num_blocks() const {
        if (my_use_blocked) {
            return int2js(my_store_blocked.get_detected().size());
        } else {
            return 1;
        }
    }

    bool js_is_blocked() const {
        return my_use_blocked;
    }

    void js_filter(const ComputeAdtQcMetricsResults& metrics, JsFakeInt blocks_raw, JsFakeInt output_raw) const {
        const auto output = js2int<std::uintptr_t>(output_raw);
        auto optr = reinterpret_cast<std::uint8_t*>(output);
        if (my_use_blocked) {
            const auto blocks = js2int<std::uintptr_t>(blocks_raw);
            my_store_blocked.filter(metrics.store(), reinterpret_cast<const std::int32_t*>(blocks), optr);
        } else {
            my_store_unblocked.filter(metrics.store(), optr);
        }
        return;
    }
};

SuggestAdtQcFiltersResults js_suggest_adt_qc_filters(const ComputeAdtQcMetricsResults& metrics, bool use_blocks, JsFakeInt blocks_raw, double nmads, double min_drop) {
    scran_qc::ComputeAdtQcFiltersOptions opt;
    opt.detected_num_mads = nmads;
    opt.subset_sum_num_mads = nmads;
    opt.detected_min_drop = min_drop;

    if (use_blocks) {
        const auto blocks = js2int<std::uintptr_t>(blocks_raw);
        auto thresholds = scran_qc::compute_adt_qc_filters_blocked(metrics.store(), reinterpret_cast<const std::int32_t*>(blocks), opt);
        return SuggestAdtQcFiltersResults(std::move(thresholds));
    } else {
        auto thresholds = scran_qc::compute_adt_qc_filters(metrics.store(), opt);
        return SuggestAdtQcFiltersResults(std::move(thresholds));
    }
}

EMSCRIPTEN_BINDINGS(quality_control_adt) {
    emscripten::function("per_cell_adt_qc_metrics", &js_per_cell_adt_qc_metrics, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ComputeAdtQcMetricsResults>("ComputeAdtQcMetricsResults")
        .function("sum", &ComputeAdtQcMetricsResults::js_sum, emscripten::return_value_policy::take_ownership())
        .function("detected", &ComputeAdtQcMetricsResults::js_detected, emscripten::return_value_policy::take_ownership())
        .function("subset_sum", &ComputeAdtQcMetricsResults::js_subset_sum, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &ComputeAdtQcMetricsResults::js_num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_cells", &ComputeAdtQcMetricsResults::js_num_cells, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("suggest_adt_qc_filters", &js_suggest_adt_qc_filters, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SuggestAdtQcFiltersResults>("SuggestAdtQcFiltersResults")
        .constructor<JsFakeInt, JsFakeInt>()
        .function("detected", &SuggestAdtQcFiltersResults::js_detected, emscripten::return_value_policy::take_ownership())
        .function("subset_sum", &SuggestAdtQcFiltersResults::js_subset_sum, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &SuggestAdtQcFiltersResults::js_num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &SuggestAdtQcFiltersResults::js_num_blocks, emscripten::return_value_policy::take_ownership())
        .function("is_blocked", &SuggestAdtQcFiltersResults::js_is_blocked, emscripten::return_value_policy::take_ownership())
        .function("filter", &SuggestAdtQcFiltersResults::js_filter, emscripten::return_value_policy::take_ownership())
        ;
}
