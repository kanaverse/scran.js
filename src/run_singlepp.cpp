#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "NeighborIndex.h"
#include "utils.h"

#include "singlepp/singlepp.hpp"
#include "singlepp_loaders/singlepp_loaders.hpp"
#include "tatami/tatami.hpp"

#include <vector>
#include <memory>
#include <cstdint>

/*****************************************/

class SingleppRawReference {
public:
    SingleppRawReference(
        singlepp_loaders::RankMatrix<double, int32_t, int32_t> ranks,
        std::vector<int32_t> labs,
        singlepp::Markers<int32_t> marks) :
        matrix(std::move(ranks)),
        labels(std::move(labs)),
        markers(std::move(marks))
    {}

public:
    singlepp_loaders::RankMatrix<double, int32_t, int32_t> matrix;
    std::vector<int32_t> labels;
    singlepp::Markers<int32_t> markers;

public:
    int32_t num_samples() const {
        return matrix.ncol();
    }

    int32_t num_features() const {
        return matrix.nrow();
    }

    int32_t num_labels() const {
        return markers.size();
    }
};

SingleppRawReference load_singlepp_reference(
    uintptr_t labels_buffer,
    size_t labels_len,
    uintptr_t markers_buffer,
    size_t markers_len,
    uintptr_t rankings_buffer,
    size_t rankings_len)
{
    singlepp_loaders::LoadLabelsOptions lopt;
    auto lab = singlepp_loaders::load_labels_from_zlib_buffer<int32_t>(reinterpret_cast<unsigned char*>(labels_buffer), labels_len, lopt);

    singlepp_loaders::LoadRankingsOptions ropt;
    auto rank = singlepp_loaders::load_rankings_from_zlib_buffer<double, int32_t>(reinterpret_cast<unsigned char*>(rankings_buffer), rankings_len, ropt);

    singlepp_loaders::LoadMarkersOptions mopt;
    auto mark = singlepp_loaders::load_markers_from_zlib_buffer<int32_t>(reinterpret_cast<unsigned char*>(markers_buffer), markers_len, mopt);

    singlepp_loaders::verify(rank, lab, mark);
    return SingleppRawReference(std::move(rank), std::move(lab), std::move(mark));
}

/*****************************************/

class SingleppTrainedReference {
public:
    typedef singlepp::TrainedSingleIntersect<int32_t, double> Store;

    Store store;

public:
    SingleppTrainedReference(Store s) : store(std::move(s)) {}

public:
    int32_t num_features() const {
        return store.get_test_subset().size();
    }

    int32_t num_labels() const {
        return store.num_labels();
    }
};

SingleppTrainedReference train_singlepp_reference(int32_t num_intersected, uintptr_t test_feature_ids, uintptr_t ref_feature_ids, const SingleppRawReference& ref, int top, bool approximate, int nthreads) {
    singlepp::TrainSingleOptions opt;
    opt.top = top;
    opt.trainer = create_builder(approximate);
    opt.num_threads = nthreads;

    singlepp::Intersection<int32_t> inter;
    {
        inter.reserve(num_intersected);
        auto tptr = reinterpret_cast<const int32_t*>(test_feature_ids);
        auto rptr = reinterpret_cast<const int32_t*>(ref_feature_ids);
        for (int32_t i = 0; i < num_intersected; ++i) {
            inter.emplace_back(tptr[i], rptr[i]);
        }
    }

    auto built = singlepp::train_single_intersect(
        inter,
        ref.matrix,
        ref.labels.data(),
        ref.markers,
        opt
    );

    return SingleppTrainedReference(std::move(built));
}

/*****************************************/

struct SingleppResults {
    typedef singlepp::ClassifySingleResults<int32_t, double> Store;

    Store store;

public:
    SingleppResults(Store s) : store(std::move(s)) {}

public:
    int32_t num_samples() const {
        return store.best.size();
    }

    int32_t num_labels() const {
        return store.scores.size();
    }

    emscripten::val best() const {
        return emscripten::val(emscripten::typed_memory_view(store.best.size(), store.best.data()));
    }

    void scores_for_sample(int32_t i, uintptr_t output) const {
        auto optr = reinterpret_cast<double*>(output);
        for (auto& s : store.scores) {
            *optr = s[i];
            ++optr;
        }
    }

    emscripten::val scores_for_label(int32_t i) const {
        const auto& current = store.scores[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val delta() const {
        return emscripten::val(emscripten::typed_memory_view(store.delta.size(), store.delta.data()));
    }
};

SingleppResults run_singlepp(const NumericMatrix& mat, const SingleppTrainedReference& built, double quantile, int nthreads) {
    singlepp::ClassifySingleOptions<double> opt;
    opt.quantile = quantile;
    opt.num_threads = nthreads;
    auto store = singlepp::classify_single_intersect(*(mat.ptr), built.store, opt);
    return SingleppResults(std::move(store));
}

/*****************************************/

struct SingleppIntegratedReferences {
    typedef singlepp::TrainedIntegrated<int32_t> Store;

    Store store;

public:
    SingleppIntegratedReferences(Store s) : store(std::move(s)) {};

public:
    size_t num_references() const {
        return store.num_references();
    }
};

SingleppIntegratedReferences integrate_singlepp_references(
    int32_t nref, 
    uintptr_t intersection_sizes,
    uintptr_t test_feature_ids,
    uintptr_t ref_feature_ids,
    uintptr_t refs, 
    uintptr_t built,
    int nthreads) 
{
    auto inter_ptr = reinterpret_cast<const int32_t*>(intersection_sizes);
    auto tid_ptrs = convert_array_of_offsets<const int32_t*>(nref, test_feature_ids);
    auto rid_ptrs = convert_array_of_offsets<const int32_t*>(nref, ref_feature_ids);
    auto ref_ptrs = convert_array_of_offsets<const SingleppRawReference*>(nref, refs);
    auto blt_ptrs = convert_array_of_offsets<const SingleppTrainedReference*>(nref, built);

    std::vector<singlepp::TrainIntegratedInput<double, int32_t, int32_t> > prepared(nref);
    for (size_t r = 0; r < nref; ++r) {
        if (static_cast<size_t>(ref_ptrs[r]->matrix.ncol()) != blt_ptrs[r]->store.num_profiles()) {
            throw std::runtime_error("mismatch in the number of profiles for reference " + std::to_string(r));
        }
        if (ref_ptrs[r]->markers.size() != blt_ptrs[r]->store.num_labels()) {
            throw std::runtime_error("mismatch in the number of labels for reference " + std::to_string(r));
        }

        singlepp::Intersection<int32_t> inter;
        {
            auto num_intersected = inter_ptr[r];
            inter.reserve(num_intersected);
            auto tptr = tid_ptrs[r];
            auto rptr = rid_ptrs[r];
            for (int32_t i = 0; i < num_intersected; ++i) {
                inter.emplace_back(tptr[i], rptr[i]);
            }
        }

        prepared[r] = singlepp::prepare_integrated_input_intersect(
            inter,
            ref_ptrs[r]->matrix,
            ref_ptrs[r]->labels.data(),
            blt_ptrs[r]->store
        );
    }

    singlepp::TrainIntegratedOptions topt;
    topt.num_threads = nthreads;
    auto store = singlepp::train_integrated(std::move(prepared), topt);
    return SingleppIntegratedReferences(std::move(store));
}

/*****************************************/

struct SingleppIntegratedResults {
    typedef singlepp::ClassifyIntegratedResults<int32_t, double> Store;

    Store store;

public:
    SingleppIntegratedResults(Store s) : store(std::move(s)) {}

public:
    int32_t num_samples() const {
        return store.best.size();
    }

    int32_t num_references() const {
        return store.scores.size();
    }

    emscripten::val best() const {
        return emscripten::val(emscripten::typed_memory_view(store.best.size(), store.best.data()));
    }

    void scores_for_sample(int32_t i, uintptr_t output) const {
        auto optr = reinterpret_cast<double*>(output);
        for (auto& s : store.scores) {
            *optr = s[i];
            ++optr;
        }
    }

    emscripten::val scores_for_reference(int32_t i) const {
        const auto& current = store.scores[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val delta() const {
        return emscripten::val(emscripten::typed_memory_view(store.delta.size(), store.delta.data()));
    }
};

SingleppIntegratedResults integrate_singlepp(const NumericMatrix& mat, uintptr_t assigned, const SingleppIntegratedReferences& integrated, double quantile, int nthreads) {
    singlepp::ClassifyIntegratedOptions<double> opt;
    opt.quantile = quantile;
    opt.num_threads = nthreads;
    auto ass_ptrs = convert_array_of_offsets<const int32_t*>(assigned, integrated.num_references());
    auto store = singlepp::classify_integrated(*(mat.ptr), ass_ptrs, integrated.store, opt);
    return SingleppIntegratedResults(std::move(store));
}

/*****************************************/

EMSCRIPTEN_BINDINGS(run_singlepp) {
    emscripten::class_<SingleppRawReference>("SingleppRawReference")
        .function("num_samples", &SingleppRawReference::num_samples, emscripten::return_value_policy::take_ownership())
        .function("num_features", &SingleppRawReference::num_features, emscripten::return_value_policy::take_ownership())
        .function("num_labels", &SingleppRawReference::num_labels, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("load_singlepp_reference", &load_singlepp_reference, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SingleppTrainedReference>("SingleppTrainedReference")
        .function("num_features", &SingleppTrainedReference::num_features, emscripten::return_value_policy::take_ownership())
        .function("num_labels", &SingleppTrainedReference::num_labels, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("train_singlepp_reference", &train_singlepp_reference, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SingleppResults>("SingleppResults")
        .function("num_samples", &SingleppResults::num_samples, emscripten::return_value_policy::take_ownership()) 
        .function("num_labels", &SingleppResults::num_labels, emscripten::return_value_policy::take_ownership())
        .function("best", &SingleppResults::best, emscripten::return_value_policy::take_ownership())
        .function("scores_for_sample", &SingleppResults::scores_for_sample, emscripten::return_value_policy::take_ownership())
        .function("scores_for_label", &SingleppResults::scores_for_label, emscripten::return_value_policy::take_ownership())
        .function("delta", &SingleppResults::delta, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("run_singlepp", &run_singlepp, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SingleppIntegratedReferences>("SingleppIntegratedReferences")
        .function("num_references", &SingleppIntegratedReferences::num_references, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("integrate_singlepp_references", &integrate_singlepp_references, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SingleppIntegratedResults>("SingleppIntegratedResults")
        .function("num_samples", &SingleppIntegratedResults::num_samples, emscripten::return_value_policy::take_ownership()) 
        .function("num_references", &SingleppIntegratedResults::num_references, emscripten::return_value_policy::take_ownership())
        .function("best", &SingleppIntegratedResults::best, emscripten::return_value_policy::take_ownership())
        .function("scores_for_sample", &SingleppIntegratedResults::scores_for_sample, emscripten::return_value_policy::take_ownership())
        .function("scores_for_reference", &SingleppIntegratedResults::scores_for_reference, emscripten::return_value_policy::take_ownership())
        .function("delta", &SingleppIntegratedResults::delta, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("integrate_singlepp", &integrate_singlepp, emscripten::return_value_policy::take_ownership());
}
