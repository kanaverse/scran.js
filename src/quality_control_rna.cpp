#include <emscripten/bind.h>

#include "parallel.h"
#include "utils.h"
#include "NumericMatrix.h"

#include "scran/scran.hpp"

#include <vector>
#include <cstdint>
#include <cmath>

struct PerCellRnaQcMetrics_Results {
    typedef scran::PerCellRnaQcMetrics::Results Store;

    Store store;

    PerCellRnaQcMetrics_Results(Store s) : store(std::move(s)) {}

public:
    emscripten::val sums() const {
        return emscripten::val(emscripten::typed_memory_view(store.sums.size(), store.sums.data()));
    }

    emscripten::val detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val subset_proportions(int i) const {
        const auto& current = store.subset_proportions[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    int num_subsets() const {
        return store.subset_proportions.size();
    }

    int num_cells() const {
        return store.sums.size();
    }
};

PerCellRnaQcMetrics_Results per_cell_rna_qc_metrics(const NumericMatrix& mat, int nsubsets, uintptr_t subsets, int nthreads) {
    scran::PerCellRnaQcMetrics qc;
    qc.set_num_threads(nthreads);
    auto store = qc.run(mat.ptr.get(), convert_array_of_offsets<const uint8_t*>(nsubsets, subsets));
    return PerCellRnaQcMetrics_Results(std::move(store));
}

struct SuggestRnaQcFilters_Results {
    typedef scran::SuggestRnaQcFilters::Thresholds Store;

    SuggestRnaQcFilters_Results(Store s) : store(std::move(s)) {}

    Store store;

    SuggestRnaQcFilters_Results(int num_subsets, int num_blocks) {
        store.sums.resize(num_blocks);
        store.detected.resize(num_blocks);
        store.subset_proportions.resize(num_subsets);
        for (int s = 0; s < num_subsets; ++s) {
            store.subset_proportions[s].resize(num_blocks);
        }
    }

public:
    emscripten::val thresholds_sums() const {
        return emscripten::val(emscripten::typed_memory_view(store.sums.size(), store.sums.data()));
    }

    emscripten::val thresholds_detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val thresholds_proportions(int i) const {
        const auto& current = store.subset_proportions[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    int num_subsets() const {
        return store.subset_proportions.size();
    }

    int num_blocks() const {
        return store.sums.size();
    }

    void filter(uintptr_t metrics, bool use_blocks, uintptr_t blocks, uintptr_t output) const {
        const int32_t* bptr = NULL;
        if (use_blocks) {
            bptr = reinterpret_cast<const int32_t*>(blocks);
        }
        const auto& mstore = reinterpret_cast<const PerCellRnaQcMetrics_Results*>(metrics)->store;
        store.filter_blocked(mstore.sums.size(), bptr, mstore.buffers(), reinterpret_cast<uint8_t*>(output));
        return;
    }
};

SuggestRnaQcFilters_Results suggest_rna_qc_filters(uintptr_t metrics, bool use_blocks, uintptr_t blocks, double nmads) {
    scran::SuggestRnaQcFilters qc;
    qc.set_num_mads(nmads);

    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    auto thresholds = qc.run_blocked(reinterpret_cast<const PerCellRnaQcMetrics_Results*>(metrics)->store, bptr);
    return SuggestRnaQcFilters_Results(std::move(thresholds));
}

EMSCRIPTEN_BINDINGS(quality_control_rna) {
    emscripten::function("per_cell_rna_qc_metrics", &per_cell_rna_qc_metrics);

    emscripten::class_<PerCellRnaQcMetrics_Results>("PerCellRnaQcMetrics_Results")
        .function("sums", &PerCellRnaQcMetrics_Results::sums)
        .function("detected", &PerCellRnaQcMetrics_Results::detected)
        .function("subset_proportions", &PerCellRnaQcMetrics_Results::subset_proportions)
        .function("num_subsets", &PerCellRnaQcMetrics_Results::num_subsets)
        .function("num_cells", &PerCellRnaQcMetrics_Results::num_cells)
        ;

    emscripten::function("suggest_rna_qc_filters", &suggest_rna_qc_filters);

    emscripten::class_<SuggestRnaQcFilters_Results>("SuggestRnaQcFilters_Results")
        .constructor<int, int>()
        .function("thresholds_sums", &SuggestRnaQcFilters_Results::thresholds_sums)
        .function("thresholds_detected", &SuggestRnaQcFilters_Results::thresholds_detected)
        .function("thresholds_proportions", &SuggestRnaQcFilters_Results::thresholds_proportions)
        .function("num_subsets", &SuggestRnaQcFilters_Results::num_subsets)
        .function("num_blocks", &SuggestRnaQcFilters_Results::num_blocks)
        .function("filter", &SuggestRnaQcFilters_Results::filter)
        ;
}
