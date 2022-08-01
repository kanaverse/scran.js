#ifndef PER_CELL_ADT_AdtQc_METRICS_RESULTS_H
#define PER_CELL_ADT_AdtQc_METRICS_RESULTS_H

#include <emscripten/bind.h>

#include "parallel.h"

#include "scran/quality_control/PerCellAdtQcMetrics.hpp"

struct PerCellAdtQcMetrics_Results {
    typedef scran::PerCellAdtQcMetrics::Results Store;

    PerCellAdtQcMetrics_Results(Store s) : store(std::move(s)) {}

    Store store;

    PerCellAdtQcMetrics_Results(int num_genes, int num_subsets) {
        store.sums.resize(num_genes);
        store.detected.resize(num_genes);
        store.subset_totals.resize(num_subsets);
        for (auto& p : store.subset_totals) {
            p.resize(num_genes);
        }
    }

    emscripten::val sums() const {
        return emscripten::val(emscripten::typed_memory_view(store.sums.size(), store.sums.data()));
    }

    emscripten::val detected() const {
        return emscripten::val(emscripten::typed_memory_view(store.detected.size(), store.detected.data()));
    }

    emscripten::val subset_totals(int i) const {
        const auto& current = store.subset_totals[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    int num_subsets() const {
        return store.subset_totals.size();
    }
};

#endif
