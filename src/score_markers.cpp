#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#include "scran/differential_analysis/ScoreMarkers.hpp"
#include "tatami/base/DelayedSubsetBlock.hpp"

#include <vector>
#include <algorithm>
#include <cstdint>

/**
 * @file score_markers.cpp
 *
 * @brief Compute marker scores for each gene in each group of cells.
 */

/**
 * @brief Javascript-visible wrapper for `scran::ScoreMarkers::Results`.
 */
struct ScoreMarkers_Results {
    /**
     * @cond
     */
    typedef scran::ScoreMarkers::Results<double> Store;

    ScoreMarkers_Results(Store s) : store(std::move(s)) {}

    Store store;
    /**
     * @endcond
     */

    /**
     * @param g Group of interest.
     * @param b Block of interest.
     * 
     * @return `Float64Array` view containing the mean log-expression of each gene for group `g` in block `b`.
     */
    emscripten::val means(int g, int b=0) const {
        const auto& current = store.means[g][b];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    /**
     * @param g Group of interest.
     * @param b Block of interest.
     * 
     * @return `Float64Array` view containing the proportion of cells with detected expression for each gene for group `g` in block `b`.
     */
    emscripten::val detected(int g, int b=0) const {
        const auto& current = store.detected[g][b];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    /**
     * @param g Group of interest.
     * @param s Summary statistic of interest for the per-gene Cohen's d from the pairwise comparisons between `g` and every other group.
     * This can be the minimum across comparisons (0), mean (1) or min-rank (4).
     * 
     * @return `Float64Array` view of length equal to the number of genes.
     * Each entry contains the summarized Cohen's D across all pairwise comparisons between `g` and every other group for a particular gene.
     */
    emscripten::val cohen(int g, int s=1) const {
        const auto& current = store.cohen[s][g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    /**
     * @param g Group of interest.
     * @param s Summary statistic of interest for the per-gene log-fold change from the pairwise comparisons between `g` and every other group.
     * This can be the minimum across comparisons (0), mean (1) or min-rank (4).
     * 
     * @return `Float64Array` view of length equal to the number of genes.
     * Each entry contains the summarized AUC across all pairwise comparisons between `g` and every other group for a particular gene.
     */
    emscripten::val auc(int g, int s=1) const {
        const auto& current = store.auc[s][g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    /**
     * @param g Group of interest.
     * @param s Summary statistic of interest for the per-gene log-fold change from the pairwise comparisons between `g` and every other group.
     * This can be the minimum across comparisons (0), mean (1) or min-rank (4).
     * 
     * @return `Float64Array` view of length equal to the number of genes.
     * Each entry contains the summarized log-fold change across all pairwise comparisons between `g` and every other group for a particular gene.
     */
    emscripten::val lfc(int g, int s=1) const {
        const auto& current = store.lfc[s][g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    /**
     * @param g Group of interest.
     * @param s Summary statistic of interest for the per-gene delta-detected from the pairwise comparisons between `g` and every other group.
     * This can be the minimum across comparisons (0), mean (1) or min-rank (4).
     * 
     * @return `Float64Array` view of length equal to the number of genes.
     * Each entry contains the summarized delta-detected across all pairwise comparisons between `g` and every other group for a particular gene.
     */
    emscripten::val delta_detected(int g, int s=1) const {
        const auto& current = store.delta_detected[s][g];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    /**
     * @return Number of groups in the marker results.
     */
    size_t num_groups() const {
        return store.detected.size();
    }

    /**
     * @return Number of blocks used, see `b` in `means()` and `detected()`.
     * If no groups are available, zero is returned regardless of whether more blocks were used in `score_markers()`.
     */
    size_t num_blocks() const {
        if (num_groups()) {
          return store.detected.front().size();
        } else {
           return 0;
        }
    }
};

/**
 * @cond
 */
template<typename Stat>
std::vector<std::vector<Stat*> > vector_to_pointers2(std::vector<std::vector<std::vector<Stat> > >& input, size_t offset) {
    std::vector<std::vector<Stat*> > ptrs;
    for (auto& current : input) {
        ptrs.push_back(scran::vector_to_pointers(current));
        for (auto& p : ptrs.back()) {
            p += offset;
        }
    }
    return ptrs;
}
/**
 * @endcond
 */

/**
 * Identify potential markers for groups of cells with a range of effect size statistics.
 *
 * @param mat An input log-expression matrix containing features in rows and cells in columns.
 * @param groups Offset to an array of `int32_t`s with `ncells` elements, containing the group assignment for each cell.
 * Group IDs should be consecutive and 0-based.
 * @param use_blocks Whether or not to compute the statistics within each block.
 * @param[in] blocks If `use_blocks = true`, offset to an array of `int32_t`s with `ncells` elements, containing the block assignment for each cell.
 * Block IDs should be consecutive and 0-based.
 * If `use_blocks = false`, this value is ignored.
 *
 * @return A `ScoreMarkers_Results` containing summary statistics from comparisons between groups of cells.
 */
ScoreMarkers_Results score_markers(const NumericMatrix& mat, uintptr_t groups, bool use_blocks, uintptr_t blocks) {
    const int32_t* gptr = reinterpret_cast<const int32_t*>(groups);
    const int32_t* bptr = NULL;
    if (use_blocks) {
        bptr = reinterpret_cast<const int32_t*>(blocks);
    }

#ifdef __EMSCRIPTEN_PTHREADS__
    size_t ngroups = *std::max_element(gptr, gptr + mat.ncol()) + 1;
    size_t nblocks = (use_blocks ? nblocks = *std::max_element(bptr, bptr + mat.ncol()) : 0) + 1;

    // Setting up the output spaces.
    auto do_effects = scran::ScoreMarkers::Defaults::compute_all_summaries();
    do_effects[scran::differential_analysis::MAX] = false;
    do_effects[scran::differential_analysis::MEDIAN] = false;
    scran::ScoreMarkers::Results<double> store(mat.nrow(), ngroups, nblocks, do_effects, do_effects, do_effects, do_effects);
    
    // Parallelizing.
    run_parallel([&](int left, int right) -> void {
        auto mean_ptrs = vector_to_pointers2(store.means, left);
        auto detect_ptrs = vector_to_pointers2(store.detected, left);

        auto cohen_ptrs = vector_to_pointers2(store.cohen, left);
        auto auc_ptrs = vector_to_pointers2(store.auc, left);
        auto lfc_ptrs = vector_to_pointers2(store.lfc, left);
        auto delta_ptrs = vector_to_pointers2(store.delta_detected, left);

        auto sub = tatami::make_DelayedSubsetBlock<0>(mat.ptr, left, right);
        scran::ScoreMarkers runner;
        runner.run_blocked(sub.get(), gptr, bptr, mean_ptrs, detect_ptrs, cohen_ptrs, auc_ptrs, lfc_ptrs, delta_ptrs);
    }, mat.nrow());
#else
    scran::ScoreMarkers mrk;
    mrk.set_summary_max(false);
    mrk.set_summary_median(false);
    auto store = mrk.run_blocked(mat.ptr.get(), gptr, bptr);
#endif

    return ScoreMarkers_Results(std::move(store));
}

/**
 * @cond 
 */
EMSCRIPTEN_BINDINGS(score_markers) {
    emscripten::function("score_markers", &score_markers);

    emscripten::class_<ScoreMarkers_Results>("ScoreMarkers_Results")
        .function("means", &ScoreMarkers_Results::means)
        .function("detected", &ScoreMarkers_Results::detected)
        .function("cohen", &ScoreMarkers_Results::cohen)
        .function("auc", &ScoreMarkers_Results::auc)
        .function("lfc", &ScoreMarkers_Results::lfc)
        .function("delta_detected", &ScoreMarkers_Results::delta_detected)
        .function("num_groups", &ScoreMarkers_Results::num_groups)
        .function("num_blocks", &ScoreMarkers_Results::num_blocks)
        ;
}
/**
 * @endcond 
 */

