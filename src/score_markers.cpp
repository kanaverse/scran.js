#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"

#include "scran_markers/scran_markers.hpp"
#include "tatami/tatami.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

static emscripten::val get_effect_summary(const scran_markers::SummaryResults<double>& res, const std::string& type) {
    if (type == "min-rank") {
        const auto& current = res.min_rank;
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    } else {
        const auto& current = [&]{
            if (type == "minimum") {
                return res.min;
            } else if (type == "maximum") {
                return res.max;
            } else if (type == "median") {
                return res.median;
            } else if (type != "mean") {
                throw std::runtime_error("unknown summary type '" + type + "'");
            }
            return res.mean;
        }();
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }
}

struct ScoreMarkersResults {
    typedef scran_markers::ScoreMarkersSummaryResults<double, int32_t> Store;

    Store store;

public:
    ScoreMarkersResults(Store s) : store(std::move(s)) {}

public:
    emscripten::val mean(int g) const {
        const auto& current = store.mean[g];
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
    emscripten::val cohens_d(int g, std::string summary) const {
        return get_effect_summary(store.cohens_d[g], summary);
    }

    emscripten::val auc(int g, std::string summary) const {
        if (store.auc.empty()) {
            throw std::runtime_error("no AUCs available in the scoreMarkers results");
        }
        return get_effect_summary(store.auc[g], summary);
    }

    emscripten::val delta_mean(int g, std::string summary) const {
        return get_effect_summary(store.delta_mean[g], summary);
    }

    emscripten::val delta_detected(int g, std::string summary) const {
        return get_effect_summary(store.delta_detected[g], summary);
    }
};

ScoreMarkersResults score_markers(
    const NumericMatrix& mat, 
    uintptr_t groups, 
    bool use_blocks, 
    uintptr_t blocks, 
    double threshold, 
    bool compute_auc, 
    bool compute_med,
    bool compute_max,
    int nthreads) 
{
    scran_markers::ScoreMarkersSummaryOptions mopt;
    mopt.threshold = threshold;
    mopt.compute_auc = compute_auc;
    mopt.compute_median = compute_med;
    mopt.compute_max = compute_max;
    mopt.num_threads = nthreads;

    auto gptr = reinterpret_cast<const int32_t*>(groups);
    if (use_blocks) {
        auto store = scran_markers::score_markers_summary_blocked(*(mat.ptr), gptr, reinterpret_cast<const int32_t*>(blocks), mopt);
        return ScoreMarkersResults(std::move(store));
    } else {
        auto store = scran_markers::score_markers_summary(*(mat.ptr), gptr, mopt);
        return ScoreMarkersResults(std::move(store));
    }
}

EMSCRIPTEN_BINDINGS(score_markers) {
    emscripten::function("score_markers", &score_markers, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ScoreMarkersResults>("ScoreMarkersResults")
        .function("mean", &ScoreMarkersResults::mean, emscripten::return_value_policy::take_ownership())
        .function("detected", &ScoreMarkersResults::detected, emscripten::return_value_policy::take_ownership())
        .function("cohens_d", &ScoreMarkersResults::cohens_d, emscripten::return_value_policy::take_ownership())
        .function("auc", &ScoreMarkersResults::auc, emscripten::return_value_policy::take_ownership())
        .function("delta_mean", &ScoreMarkersResults::delta_mean, emscripten::return_value_policy::take_ownership())
        .function("delta_detected", &ScoreMarkersResults::delta_detected, emscripten::return_value_policy::take_ownership())
        .function("num_groups", &ScoreMarkersResults::num_groups, emscripten::return_value_policy::take_ownership())
        ;
}
