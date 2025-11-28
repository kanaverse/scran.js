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
        const auto& current = [&]() -> const std::vector<double>& {
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

class ScoreMarkersResults {
    typedef scran_markers::ScoreMarkersSummaryResults<double, int32_t> Store;

    Store my_store;

public:
    ScoreMarkersResults(Store s) : my_store(std::move(s)) {}

    const Store& store() const {
        return my_store;
    }

public:
    emscripten::val mean(std::int32_t g) const {
        const auto& current = my_store.mean[g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val detected(std::int32_t g) const {
        const auto& current = my_store.detected[g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    JsFakeInt num_groups() const {
        return int2js(my_store.detected.size());
    }

public:
    emscripten::val cohens_d(int32_t g, std::string summary) const {
        return get_effect_summary(my_store.cohens_d[g], summary);
    }

    emscripten::val auc(int32_t g, std::string summary) const {
        if (my_store.auc.empty()) {
            throw std::runtime_error("no AUCs available in the scoreMarkers results");
        }
        return get_effect_summary(my_store.auc[g], summary);
    }

    emscripten::val delta_mean(int32_t g, std::string summary) const {
        return get_effect_summary(my_store.delta_mean[g], summary);
    }

    emscripten::val delta_detected(int32_t g, std::string summary) const {
        return get_effect_summary(my_store.delta_detected[g], summary);
    }
};

ScoreMarkersResults score_markers(
    const NumericMatrix& mat, 
    std::uintptr_t groups, 
    bool use_blocks, 
    std::uintptr_t blocks, 
    double threshold, 
    bool compute_auc, 
    bool compute_med,
    bool compute_max,
    JsFakeInt nthreads_raw
) {
    scran_markers::ScoreMarkersSummaryOptions mopt;
    mopt.threshold = threshold;
    mopt.compute_auc = compute_auc;
    mopt.compute_median = compute_med;
    mopt.compute_max = compute_max;
    mopt.num_threads = js2int<int>(nthreads_raw);

    auto gptr = reinterpret_cast<const std::int32_t*>(groups);
    if (use_blocks) {
        auto store = scran_markers::score_markers_summary_blocked(*mat, gptr, reinterpret_cast<const std::int32_t*>(blocks), mopt);
        return ScoreMarkersResults(std::move(store));
    } else {
        auto store = scran_markers::score_markers_summary(*mat, gptr, mopt);
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
