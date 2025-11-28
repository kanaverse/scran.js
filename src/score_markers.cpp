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
    typedef scran_markers::ScoreMarkersSummaryResults<double, std::int32_t> Store;

    Store my_store;

public:
    ScoreMarkersResults(Store s) : my_store(std::move(s)) {}

    const Store& store() const {
        return my_store;
    }

public:
    emscripten::val js_mean(JsFakeInt g_raw) const {
        const auto& current = my_store.mean[js2int<std::size_t>(g_raw)];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val js_detected(JsFakeInt g_raw) const {
        const auto& current = my_store.detected[js2int<std::size_t>(g_raw)];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    JsFakeInt js_num_groups() const {
        return int2js(my_store.detected.size());
    }

public:
    emscripten::val js_cohens_d(JsFakeInt g_raw, std::string summary) const {
        return get_effect_summary(my_store.cohens_d[js2int<std::size_t>(g_raw)], summary);
    }

    emscripten::val js_auc(JsFakeInt g_raw, std::string summary) const {
        if (my_store.auc.empty()) {
            throw std::runtime_error("no AUCs available in the scoreMarkers results");
        }
        return get_effect_summary(my_store.auc[js2int<std::size_t>(g_raw)], summary);
    }

    emscripten::val js_delta_mean(JsFakeInt g_raw, std::string summary) const {
        return get_effect_summary(my_store.delta_mean[js2int<std::size_t>(g_raw)], summary);
    }

    emscripten::val js_delta_detected(JsFakeInt g_raw, std::string summary) const {
        return get_effect_summary(my_store.delta_detected[js2int<std::size_t>(g_raw)], summary);
    }
};

ScoreMarkersResults js_score_markers(
    const NumericMatrix& mat, 
    JsFakeInt groups_raw, 
    bool use_blocks, 
    JsFakeInt blocks_raw, 
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

    const auto groups = js2int<std::uintptr_t>(groups_raw);
    auto gptr = reinterpret_cast<const std::int32_t*>(groups);
    if (use_blocks) {
        const auto blocks = js2int<std::uintptr_t>(blocks_raw);
        auto store = scran_markers::score_markers_summary_blocked(*mat, gptr, reinterpret_cast<const std::int32_t*>(blocks), mopt);
        return ScoreMarkersResults(std::move(store));
    } else {
        auto store = scran_markers::score_markers_summary(*mat, gptr, mopt);
        return ScoreMarkersResults(std::move(store));
    }
}

EMSCRIPTEN_BINDINGS(score_markers) {
    emscripten::function("score_markers", &js_score_markers, emscripten::return_value_policy::take_ownership());

    emscripten::class_<ScoreMarkersResults>("ScoreMarkersResults")
        .function("mean", &ScoreMarkersResults::js_mean, emscripten::return_value_policy::take_ownership())
        .function("detected", &ScoreMarkersResults::js_detected, emscripten::return_value_policy::take_ownership())
        .function("cohens_d", &ScoreMarkersResults::js_cohens_d, emscripten::return_value_policy::take_ownership())
        .function("auc", &ScoreMarkersResults::js_auc, emscripten::return_value_policy::take_ownership())
        .function("delta_mean", &ScoreMarkersResults::js_delta_mean, emscripten::return_value_policy::take_ownership())
        .function("delta_detected", &ScoreMarkersResults::js_delta_detected, emscripten::return_value_policy::take_ownership())
        .function("num_groups", &ScoreMarkersResults::js_num_groups, emscripten::return_value_policy::take_ownership())
        ;
}
