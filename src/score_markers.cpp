#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/scran.hpp"
#include "tatami/tatami.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

struct ScoreMarkers_Results {
    typedef scran::ScoreMarkers::Results<double> Store;

    ScoreMarkers_Results(Store s) : store(std::move(s)) {}

    Store store;

public:
    emscripten::val means(int g) const {
        const auto& current = store.means[g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val detected(int g) const {
        const auto& current = store.detected[g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    size_t num_groups() const {
        return store.detected.size();
    }

public:
    emscripten::val cohen(int g, int s) const {
        const auto& current0 = store.cohen[s];
        if (current0.size() == 0) {
            throw std::runtime_error("summary type " + std::to_string(s) + " not available for Cohen's d");
        }

        const auto& current = current0[g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val auc(int g, int s) const {
        if (store.auc.empty()) {
            throw std::runtime_error("no AUCs available in the scoreMarkers results");
        }

        const auto& current0 = store.auc[s];
        if (current0.size() == 0) {
            throw std::runtime_error("summary type " + std::to_string(s) + " not available for AUCs");
        }

        const auto& current = current0[g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val lfc(int g, int s) const {
        const auto& current0 = store.lfc[s];
        if (current0.size() == 0) {
            throw std::runtime_error("summary type " + std::to_string(s) + " not available for log-fold changes");
        }

        const auto& current = current0[g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val delta_detected(int g, int s) const {
        const auto& current0 = store.delta_detected[s];
        if (current0.size() == 0) {
            throw std::runtime_error("summary type " + std::to_string(s) + " not available for the delta detected");
        }

        const auto& current = current0[g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
};

ScoreMarkers_Results score_markers(
    const NumericMatrix& mat, 
    uintptr_t groups, 
    bool use_blocks, 
    uintptr_t blocks, 
    double lfc_threshold, 
    bool compute_auc, 
    bool compute_med,
    bool compute_max,
    int nthreads) 
{
    const int32_t* gptr = reinterpret_cast<const int32_t*>(groups);
    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

    scran::ScoreMarkers mrk;
    mrk.set_summary_max(compute_med);
    mrk.set_summary_median(compute_max);
    mrk.set_num_threads(nthreads);
    mrk.set_threshold(lfc_threshold);
    mrk.set_compute_auc(compute_auc);

    auto store = mrk.run_blocked(mat.ptr.get(), gptr, bptr);

    return ScoreMarkers_Results(std::move(store));
}

EMSCRIPTEN_BINDINGS(score_markers) {
    emscripten::function("score_markers", &score_markers, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ScoreMarkers_Results>("ScoreMarkers_Results")
        .function("means", &ScoreMarkers_Results::means, emscripten::return_value_policy::take_ownership())
        .function("detected", &ScoreMarkers_Results::detected, emscripten::return_value_policy::take_ownership())
        .function("cohen", &ScoreMarkers_Results::cohen, emscripten::return_value_policy::take_ownership())
        .function("auc", &ScoreMarkers_Results::auc, emscripten::return_value_policy::take_ownership())
        .function("lfc", &ScoreMarkers_Results::lfc, emscripten::return_value_policy::take_ownership())
        .function("delta_detected", &ScoreMarkers_Results::delta_detected, emscripten::return_value_policy::take_ownership())
        .function("num_groups", &ScoreMarkers_Results::num_groups, emscripten::return_value_policy::take_ownership())
        ;
}
