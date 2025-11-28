#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#include "scran_qc/scran_qc.hpp"

#include <cstdint>
#include <cstddef>

class ComputeRnaQcMetricsResults {
private:
    typedef scran_qc::ComputeRnaQcMetricsResults<double, std::int32_t, double> Store;

    Store my_store;

public:
    ComputeRnaQcMetricsResults(Store s) : my_store(std::move(s)) {}

    const Store& store() const {
        return my_store;
    }

public:
    emscripten::val sum() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.sum.size(), my_store.sum.data()));
    }

    emscripten::val detected() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.detected.size(), my_store.detected.data()));
    }

    emscripten::val subset_proportion(JsFakeInt i_raw) const {
        const auto& current = my_store.subset_proportion[js2int<std::size_t>(i_raw)];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    JsFakeInt num_subsets() const {
        return int2js(my_store.subset_proportion.size());
    }

    JsFakeInt num_cells() const {
        return int2js(my_store.sum.size());
    }
};

ComputeRnaQcMetricsResults compute_rna_qc_metrics(const NumericMatrix& mat, JsFakeInt nsubsets_raw, JsFakeInt subsets_raw, JsFakeInt nthreads_raw) {
    scran_qc::ComputeRnaQcMetricsOptions opt;
    opt.num_threads = js2int<int>(nthreads_raw);
    auto store = scran_qc::compute_rna_qc_metrics(*mat, convert_array_of_offsets<const std::uint8_t*>(nsubsets_raw, subsets_raw), opt);
    return ComputeRnaQcMetricsResults(std::move(store));
}

class SuggestRnaQcFiltersResults {
private:
    bool my_use_blocked = true;
    scran_qc::RnaQcFilters<double> my_store_unblocked;
    scran_qc::RnaQcBlockedFilters<double> my_store_blocked;

public:
    SuggestRnaQcFiltersResults(scran_qc::RnaQcFilters<double> store) : my_store_unblocked(std::move(store)), my_use_blocked(false) {}

    SuggestRnaQcFiltersResults(scran_qc::RnaQcBlockedFilters<double> store) : my_store_blocked(std::move(store)) {}

    SuggestRnaQcFiltersResults(JsFakeInt num_subsets_raw, JsFakeInt num_blocks_raw) {
        const auto num_subsets = js2int<std::size_t>(num_subsets_raw);
        const auto num_blocks = js2int<std::size_t>(num_blocks_raw);

        if (num_blocks <= 1) {
            my_use_blocked = false;
            sanisizer::resize(my_store_unblocked.get_subset_proportion(), num_subsets);
        } else {
            sanisizer::resize(my_store_blocked.get_sum(), num_blocks);
            sanisizer::resize(my_store_blocked.get_detected(), num_blocks);
            auto& subprop = my_store_blocked.get_subset_proportion();
            sanisizer::resize(subprop, num_subsets);
            for (I<decltype(num_subsets)> s = 0; s < num_subsets; ++s) {
                sanisizer::resize(subprop[s], num_blocks);
            }
        }
    }

public:
    emscripten::val sum() {
        if (my_use_blocked) {
            auto& sum = my_store_blocked.get_sum();
            return emscripten::val(emscripten::typed_memory_view(sum.size(), sum.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& sum = my_store_unblocked.get_sum();
            return emscripten::val(emscripten::typed_memory_view(1, &sum));
        }
    }

    emscripten::val detected() {
        if (my_use_blocked) {
            auto& det = my_store_blocked.get_detected();
            return emscripten::val(emscripten::typed_memory_view(det.size(), det.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& det = my_store_unblocked.get_detected();
            return emscripten::val(emscripten::typed_memory_view(1, &det));
        }
    }

    emscripten::val subset_proportion(JsFakeInt i_raw) {
        const auto i = js2int<std::size_t>(i_raw); 
        if (my_use_blocked) {
            auto& current = my_store_blocked.get_subset_proportion()[i];
            return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& current = my_store_unblocked.get_subset_proportion()[i];
            return emscripten::val(emscripten::typed_memory_view(1, &current));
        }
    }

public:
    JsFakeInt num_subsets() const {
        if (my_use_blocked) {
            return int2js(my_store_blocked.get_subset_proportion().size());
        } else {
            return int2js(my_store_unblocked.get_subset_proportion().size());
        }
    }

    JsFakeInt num_blocks() const {
        if (my_use_blocked) {
            return int2js(my_store_blocked.get_sum().size());
        } else {
            return 1;
        }
    }

    bool is_blocked() const {
        return my_use_blocked;
    }

    void filter(const ComputeRnaQcMetricsResults& metrics, JsFakeInt blocks_raw, JsFakeInt output_raw) const {
        const auto output = js2int<std::uintptr_t>(output_raw);
        auto optr = reinterpret_cast<std::uint8_t*>(output);
        if (my_use_blocked) {
            const auto blocks = js2int<std::uintptr_t>(blocks_raw);
            my_store_blocked.filter(metrics.store(), reinterpret_cast<const std::int32_t*>(blocks), optr);
        } else {
            my_store_unblocked.filter(metrics.store(), optr);
        }
    }
};

SuggestRnaQcFiltersResults suggest_rna_qc_filters(const ComputeRnaQcMetricsResults& metrics, bool use_blocks, JsFakeInt blocks_raw, double nmads) {
    scran_qc::ComputeRnaQcFiltersOptions opt;
    opt.sum_num_mads = nmads;
    opt.detected_num_mads = nmads;
    opt.subset_proportion_num_mads = nmads;

    if (use_blocks) {
        const auto blocks = js2int<std::uintptr_t>(blocks_raw);
        auto thresholds = scran_qc::compute_rna_qc_filters_blocked(metrics.store(), reinterpret_cast<const std::int32_t*>(blocks), opt);
        return SuggestRnaQcFiltersResults(std::move(thresholds));
    } else {
        auto thresholds = scran_qc::compute_rna_qc_filters(metrics.store(), opt);
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
        .constructor<JsFakeInt, JsFakeInt>()
        .function("sum", &SuggestRnaQcFiltersResults::sum, emscripten::return_value_policy::take_ownership())
        .function("detected", &SuggestRnaQcFiltersResults::detected, emscripten::return_value_policy::take_ownership())
        .function("subset_proportion", &SuggestRnaQcFiltersResults::subset_proportion, emscripten::return_value_policy::take_ownership())
        .function("num_subsets", &SuggestRnaQcFiltersResults::num_subsets, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &SuggestRnaQcFiltersResults::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("is_blocked", &SuggestRnaQcFiltersResults::is_blocked, emscripten::return_value_policy::take_ownership())
        .function("filter", &SuggestRnaQcFiltersResults::filter, emscripten::return_value_policy::take_ownership())
        ;
}
