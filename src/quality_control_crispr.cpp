#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#include "scran_qc/scran_qc.hpp"

#include <cstdint>
#include <cstddef>

class ComputeCrisprQcMetricsResults {
private:
    typedef scran_qc::ComputeCrisprQcMetricsResults<double> Store;

    Store my_store;

public:
    ComputeCrisprQcMetricsResults(Store s) : my_store(std::move(s)) {}

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

    emscripten::val max_value() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.max_value.size(), my_store.max_value.data()));
    }

    emscripten::val max_index() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.max_index.size(), my_store.max_index.data()));
    }

    JsFakeInt num_cells() const {
        return int2js(my_store.sum.size());
    }
};

ComputeCrisprQcMetricsResults per_cell_crispr_qc_metrics(const NumericMatrix& mat, JsFakeInt nthreads_raw) {
    scran_qc::ComputeCrisprQcMetricsOptions opt;
    opt.num_threads = js2int<int>(nthreads_raw);
    auto store = scran_qc::compute_crispr_qc_metrics(*mat, opt);
    return ComputeCrisprQcMetricsResults(std::move(store));
}

class SuggestCrisprQcFiltersResults {
private:
    bool my_use_blocked = true;
    scran_qc::CrisprQcFilters<double> my_store_unblocked;
    scran_qc::CrisprQcBlockedFilters<double> my_store_blocked;

public:
    SuggestCrisprQcFiltersResults(scran_qc::CrisprQcFilters<double> store) : my_store_unblocked(std::move(store)), my_use_blocked(false) {}

    SuggestCrisprQcFiltersResults(scran_qc::CrisprQcBlockedFilters<double> store) : my_store_blocked(std::move(store)) {}

    SuggestCrisprQcFiltersResults(JsFakeInt num_blocks_raw) {
        auto num_blocks = js2int<std::size_t>(num_blocks_raw);
        if (num_blocks <= 1) {
            my_use_blocked = false;
        } else {
            sanisizer::resize(my_store_blocked.get_max_value(), num_blocks);
        }
    }

public:
    emscripten::val max_value() {
        if (my_use_blocked) {
            auto& mc = my_store_blocked.get_max_value();
            return emscripten::val(emscripten::typed_memory_view(mc.size(), mc.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& mc = my_store_unblocked.get_max_value();
            return emscripten::val(emscripten::typed_memory_view(1, &mc));
        } 
    }

    JsFakeInt num_blocks() const {
        if (my_use_blocked) {
            return int2js(my_store_blocked.get_max_value().size());
        } else {
            return 1;
        }
    }

    bool is_blocked() const {
        return my_use_blocked;
    }

    void filter(const ComputeCrisprQcMetricsResults& metrics, JsFakeInt blocks_raw, JsFakeInt output_raw) const {
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

SuggestCrisprQcFiltersResults suggest_crispr_qc_filters(const ComputeCrisprQcMetricsResults& metrics, bool use_blocks, JsFakeInt blocks_raw, double nmads) {
    scran_qc::ComputeCrisprQcFiltersOptions opt;
    opt.max_value_num_mads = nmads;

    if (use_blocks) {
        const auto blocks = js2int<std::uintptr_t>(blocks_raw);
        auto thresholds = scran_qc::compute_crispr_qc_filters_blocked(metrics.store(), reinterpret_cast<const std::int32_t*>(blocks), opt);
        return SuggestCrisprQcFiltersResults(std::move(thresholds));
    } else {
        auto thresholds = scran_qc::compute_crispr_qc_filters(metrics.store(), opt);
        return SuggestCrisprQcFiltersResults(std::move(thresholds));
    }
}

EMSCRIPTEN_BINDINGS(quality_control_crispr) {
    emscripten::function("per_cell_crispr_qc_metrics", &per_cell_crispr_qc_metrics, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ComputeCrisprQcMetricsResults>("ComputeCrisprQcMetricsResults")
        .function("sum", &ComputeCrisprQcMetricsResults::sum, emscripten::return_value_policy::take_ownership())
        .function("detected", &ComputeCrisprQcMetricsResults::detected, emscripten::return_value_policy::take_ownership())
        .function("max_value", &ComputeCrisprQcMetricsResults::max_value, emscripten::return_value_policy::take_ownership())
        .function("max_index", &ComputeCrisprQcMetricsResults::max_index, emscripten::return_value_policy::take_ownership())
        .function("num_cells", &ComputeCrisprQcMetricsResults::num_cells, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("suggest_crispr_qc_filters", &suggest_crispr_qc_filters, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SuggestCrisprQcFiltersResults>("SuggestCrisprQcFiltersResults")
        .constructor<JsFakeInt>()
        .function("max_value", &SuggestCrisprQcFiltersResults::max_value, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &SuggestCrisprQcFiltersResults::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("is_blocked", &SuggestCrisprQcFiltersResults::is_blocked, emscripten::return_value_policy::take_ownership())
        .function("filter", &SuggestCrisprQcFiltersResults::filter, emscripten::return_value_policy::take_ownership())
        ;
}
