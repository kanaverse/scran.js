#include <emscripten/bind.h>

#include "parallel.h"
#include "utils.h"
#include "NumericMatrix.h"

#include "scran/quality_control/PerCellCrisprQcMetrics.hpp"
#include "scran/quality_control/SuggestCrisprQcFilters.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

struct PerCellCrisprQcMetrics_Results {
    typedef scran::PerCellCrisprQcMetrics::Results Store;

    Store store;

    PerCellCrisprQcMetrics_Results(Store s) : store(std::move(s)) {}

    PerCellCrisprQcMetrics_Results(int num_cells) {
        store.sums.resize(num_cells);
        store.detected.resize(num_cells);
        store.max_proportion.resize(num_cells);
        store.max_index.resize(num_cells);
    }

    emscripten::val sums() const {
        return emscripten::val(emscripten::typed_memory_view(store.sums.size(), store.sums.data()));
    }

    emscripten::val detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val max_proportion() const {
        return emscripten::val(emscripten::typed_memory_view(store.max_proportion.size(), store.max_proportion.data()));
    }

    emscripten::val max_index() const {
        return emscripten::val(emscripten::typed_memory_view(store.max_index.size(), store.max_index.data()));
    }

    int num_cells() const {
        return store.sums.size();
    }
};

PerCellCrisprQcMetrics_Results per_cell_crispr_qc_metrics(const NumericMatrix& mat, int nthreads) {
    scran::PerCellCrisprQcMetrics qc;
    qc.set_num_threads(nthreads);
    auto store = qc.run(mat.ptr.get());
    return PerCellCrisprQcMetrics_Results(std::move(store));
}

struct SuggestCrisprQcFilters_Results {
    typedef scran::SuggestCrisprQcFilters::Thresholds Store;

    SuggestCrisprQcFilters_Results(Store s) : store(std::move(s)) {}

    Store store;

    SuggestCrisprQcFilters_Results(int num_blocks) {
        store.max_count.resize(num_blocks);
    }

    emscripten::val thresholds_max_count() const {
        return emscripten::val(emscripten::typed_memory_view(store.max_count.size(), store.max_count.data()));
    }

    int num_blocks() const {
        return store.max_count.size();
    }

    void filter(uintptr_t metrics, bool use_blocks, uintptr_t blocks, uintptr_t output) const {
        const int32_t* bptr = NULL;
        if (use_blocks) {
            bptr = reinterpret_cast<const int32_t*>(blocks);
        }
        const auto& mstore = reinterpret_cast<const PerCellCrisprQcMetrics_Results*>(metrics)->store;
        store.filter_blocked(mstore.sums.size(), bptr, mstore.buffers(), reinterpret_cast<uint8_t*>(output));
        return;
    }
};

SuggestCrisprQcFilters_Results suggest_crispr_qc_filters(uintptr_t metrics, bool use_blocks, uintptr_t blocks, double nmads) {
    scran::SuggestCrisprQcFilters qc;
    qc.set_num_mads(nmads);

    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    auto thresholds = qc.run_blocked(reinterpret_cast<const PerCellCrisprQcMetrics_Results*>(metrics)->store, bptr);
    return SuggestCrisprQcFilters_Results(std::move(thresholds));
}

EMSCRIPTEN_BINDINGS(quality_control_crispr) {
    emscripten::function("per_cell_crispr_qc_metrics", &per_cell_crispr_qc_metrics);

    emscripten::class_<PerCellCrisprQcMetrics_Results>("PerCellCrisprQcMetrics_Results")
        .constructor<int>()
        .function("sums", &PerCellCrisprQcMetrics_Results::sums)
        .function("detected", &PerCellCrisprQcMetrics_Results::detected)
        .function("max_proportion", &PerCellCrisprQcMetrics_Results::max_proportion)
        .function("max_index", &PerCellCrisprQcMetrics_Results::max_index)
        .function("num_cells", &PerCellCrisprQcMetrics_Results::num_cells)
        ;

    emscripten::function("suggest_crispr_qc_filters", &suggest_crispr_qc_filters);

    emscripten::class_<SuggestCrisprQcFilters_Results>("SuggestCrisprQcFilters_Results")
        .constructor<int>()
        .function("thresholds_max_count", &SuggestCrisprQcFilters_Results::thresholds_max_count)
        .function("num_blocks", &SuggestCrisprQcFilters_Results::num_blocks)
        .function("filter", &SuggestCrisprQcFilters_Results::filter)
        ;
}
