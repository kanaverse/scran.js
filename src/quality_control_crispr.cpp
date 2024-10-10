#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#include "scran_qc/scran_qc.hpp"

#include <cstdint>

struct ComputeCrisprQcMetricsResults {
    typedef scran_qc::ComputeCrisprQcMetricsResults<double> Store;

    Store store;

public:
    ComputeCrisprQcMetricsResults(Store s) : store(std::move(s)) {}

public:
    emscripten::val sum() const {
        return emscripten::val(emscripten::typed_memory_view(store.sum.size(), store.sum.data()));
    }

    emscripten::val detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val max_value() const {
        return emscripten::val(emscripten::typed_memory_view(store.max_value.size(), store.max_value.data()));
    }

    emscripten::val max_index() const {
        return emscripten::val(emscripten::typed_memory_view(store.max_index.size(), store.max_index.data()));
    }

    int32_t num_cells() const {
        return store.sum.size();
    }
};

ComputeCrisprQcMetricsResults per_cell_crispr_qc_metrics(const NumericMatrix& mat, int32_t nthreads) {
    scran_qc::ComputeCrisprQcMetricsOptions opt;
    opt.num_threads = nthreads;
    auto store = scran_qc::compute_crispr_qc_metrics(*(mat.ptr), opt);
    return ComputeCrisprQcMetricsResults(std::move(store));
}

struct SuggestCrisprQcFiltersResults {
    bool use_blocked = true;
    scran_qc::CrisprQcFilters<double> store_unblocked;
    scran_qc::CrisprQcBlockedFilters<double> store_blocked;

public:
    SuggestCrisprQcFiltersResults(scran_qc::CrisprQcFilters<double> store) : store_unblocked(std::move(store)), use_blocked(false) {}

    SuggestCrisprQcFiltersResults(scran_qc::CrisprQcBlockedFilters<double> store) : store_blocked(std::move(store)) {}

    SuggestCrisprQcFiltersResults(int32_t num_blocks) {
        if (num_blocks <= 1) {
            use_blocked = false;
        } else {
            store_blocked.get_max_value().resize(num_blocks);
        }
    }

public:
    emscripten::val thresholds_max_value() {
        if (use_blocked) {
            auto& mc = store_blocked.get_max_value();
            return emscripten::val(emscripten::typed_memory_view(mc.size(), mc.data()));
        } else {
            // Very important to be non-const, otherwise we'd take a reference to a temporary.
            auto& mc = store_unblocked.get_max_value();
            return emscripten::val(emscripten::typed_memory_view(1, &mc));
        } 
    }

    int32_t num_blocks() const {
        if (use_blocked) {
            return store_blocked.get_max_value().size();
        } else {
            return 1;
        }
    }

    bool is_blocked() const {
        return use_blocked;
    }

    void filter(const ComputeCrisprQcMetricsResults& metrics, uintptr_t blocks, uintptr_t output) const {
        auto optr = reinterpret_cast<uint8_t*>(output);
        if (use_blocked) {
            store_blocked.filter(metrics.store, reinterpret_cast<const int32_t*>(blocks), optr);
        } else {
            store_unblocked.filter(metrics.store, optr);
        }
        return;
    }
};

SuggestCrisprQcFiltersResults suggest_crispr_qc_filters(const ComputeCrisprQcMetricsResults& metrics, bool use_blocks, uintptr_t blocks, double nmads) {
    scran_qc::ComputeCrisprQcFiltersOptions opt;
    opt.max_value_num_mads = nmads;

    if (use_blocks) {
        auto thresholds = scran_qc::compute_crispr_qc_filters_blocked(metrics.store, reinterpret_cast<const int32_t*>(blocks), opt);
        return SuggestCrisprQcFiltersResults(std::move(thresholds));
    } else {
        auto thresholds = scran_qc::compute_crispr_qc_filters(metrics.store, opt);
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
        .constructor<int32_t>()
        .function("thresholds_max_value", &SuggestCrisprQcFiltersResults::thresholds_max_value, emscripten::return_value_policy::take_ownership())
        .function("num_blocks", &SuggestCrisprQcFiltersResults::num_blocks, emscripten::return_value_policy::take_ownership())
        .function("is_blocked", &SuggestCrisprQcFiltersResults::is_blocked, emscripten::return_value_policy::take_ownership())
        .function("filter", &SuggestCrisprQcFiltersResults::filter, emscripten::return_value_policy::take_ownership())
        ;
}
