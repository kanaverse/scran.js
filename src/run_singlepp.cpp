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
#include <iostream>

/*****************************************/

class SingleppRawReference {
public:
    SingleppRawReference(
        singlepp_loaders::RankMatrix<double, std::int32_t, std::int32_t> ranks,
        std::vector<std::int32_t> labs,
        singlepp::Markers<std::int32_t> marks
    ) :
        my_matrix(std::move(ranks)),
        my_labels(std::move(labs)),
        my_markers(std::move(marks))
    {}

private:
    singlepp_loaders::RankMatrix<double, std::int32_t, std::int32_t> my_matrix;
    std::vector<std::int32_t> my_labels;
    singlepp::Markers<std::int32_t> my_markers;

public:
    const auto& matrix() const {
        return my_matrix;
    }

    const auto& labels() const {
        return my_labels;
    }

    const auto& markers() const {
        return my_markers;
    }

public:
    JsFakeInt js_num_samples() const {
        return int2js(my_matrix.ncol());
    }

    JsFakeInt js_num_features() const {
        return int2js(my_matrix.nrow());
    }

    JsFakeInt js_num_labels() const {
        return int2js(my_markers.size());
    }
};

SingleppRawReference js_load_singlepp_reference(
    JsFakeInt labels_buffer_raw,
    JsFakeInt labels_len_raw,
    JsFakeInt markers_buffer_raw,
    JsFakeInt markers_len_raw,
    JsFakeInt rankings_buffer_raw,
    JsFakeInt rankings_len_raw
) {
    singlepp_loaders::LoadLabelsOptions lopt;
    auto lab = singlepp_loaders::load_labels_from_zlib_buffer<std::int32_t>(
        reinterpret_cast<unsigned char*>(js2int<std::uintptr_t>(labels_buffer_raw)),
        js2int<std::size_t>(labels_len_raw),
        lopt
    );

    singlepp_loaders::LoadRankingsOptions ropt;
    auto rank = singlepp_loaders::load_rankings_from_zlib_buffer<double, std::int32_t>(
        reinterpret_cast<unsigned char*>(js2int<std::uintptr_t>(rankings_buffer_raw)),
        js2int<std::size_t>(rankings_len_raw),
        ropt
    );

    singlepp_loaders::LoadMarkersOptions mopt;
    auto mark = singlepp_loaders::load_markers_from_zlib_buffer<std::int32_t>(
        reinterpret_cast<unsigned char*>(js2int<std::uintptr_t>(markers_buffer_raw)),
        js2int<std::size_t>(markers_len_raw),
        mopt
    );

    singlepp_loaders::verify(rank, lab, mark);
    return SingleppRawReference(std::move(rank), std::move(lab), std::move(mark));
}

/*****************************************/

class SingleppTrainedReference {
private:
    typedef singlepp::TrainedSingleIntersect<std::int32_t, double> Store;

    Store my_store;

public:
    SingleppTrainedReference(Store s) : my_store(std::move(s)) {}

    const Store& store() const {
        return my_store;
    }

public:
    JsFakeInt js_num_features() const {
        return int2js(my_store.get_test_subset().size());
    }

    JsFakeInt js_num_labels() const {
        return int2js(my_store.num_labels());
    }
};

SingleppTrainedReference js_train_singlepp_reference(
    JsFakeInt num_test_features_raw,
    JsFakeInt num_intersected_raw,
    JsFakeInt test_feature_ids_raw,
    JsFakeInt ref_feature_ids_raw,
    const SingleppRawReference& ref,
    JsFakeInt top_raw,
    bool approximate,
    JsFakeInt nthreads_raw
) {
    singlepp::TrainSingleOptions<std::int32_t, double, knncolle::SimpleMatrix<std::int32_t, double> > opt;
    opt.top = js2int<int>(top_raw);
    opt.trainer = create_builder(approximate);
    opt.num_threads = js2int<int>(nthreads_raw);

    singlepp::Intersection<std::int32_t> inter;
    {
        const auto num_intersected = js2int<std::size_t>(num_intersected_raw);
        inter.reserve(num_intersected);

        const auto test_feature_ids = js2int<std::uintptr_t>(test_feature_ids_raw);
        auto tptr = reinterpret_cast<const std::int32_t*>(test_feature_ids);

        const auto ref_feature_ids = js2int<std::uintptr_t>(ref_feature_ids_raw);
        auto rptr = reinterpret_cast<const std::int32_t*>(ref_feature_ids);

        for (I<decltype(num_intersected)> i = 0; i < num_intersected; ++i) {
            inter.emplace_back(tptr[i], rptr[i]);
        }
    }

    auto built = singlepp::train_single_intersect(
        js2int<std::int32_t>(num_test_features_raw),
        inter,
        ref.matrix(),
        ref.labels().data(),
        ref.markers(),
        opt
    );

    return SingleppTrainedReference(std::move(built));
}

/*****************************************/

class SingleppResults {
private:
    typedef singlepp::ClassifySingleResults<std::int32_t, double> Store;

    Store my_store;

public:
    SingleppResults(Store s) : my_store(std::move(s)) {}

    const Store& store() const {
        return my_store;
    }

public:
    JsFakeInt js_num_samples() const {
        return int2js(my_store.best.size());
    }

    JsFakeInt js_num_labels() const {
        return int2js(my_store.scores.size());
    }

    emscripten::val js_best() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.best.size(), my_store.best.data()));
    }

    void js_score_for_sample(JsFakeInt i_raw, JsFakeInt output_raw) const {
        const auto output = js2int<std::uintptr_t>(output_raw);
        auto optr = reinterpret_cast<double*>(output);
        const auto i = js2int<std::size_t>(i_raw); 
        for (auto& s : my_store.scores) {
            *optr = s[i];
            ++optr;
        }
    }

    emscripten::val js_score_for_label(JsFakeInt i_raw) const {
        const auto i = js2int<std::size_t>(i_raw); 
        const auto& current = my_store.scores[i];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val js_delta() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.delta.size(), my_store.delta.data()));
    }
};

SingleppResults js_run_singlepp(
    const NumericMatrix& mat,
    const SingleppTrainedReference& built,
    double quantile,
    JsFakeInt nthreads_raw
) {
    singlepp::ClassifySingleOptions<double> opt;
    opt.quantile = quantile;
    opt.num_threads = js2int<int>(nthreads_raw);
    auto store = singlepp::classify_single_intersect(*mat, built.store(), opt);
    return SingleppResults(std::move(store));
}

/*****************************************/

class SingleppIntegratedReferences {
private:
    typedef singlepp::TrainedIntegrated<std::int32_t> Store;

    Store my_store;

public:
    SingleppIntegratedReferences(Store s) : my_store(std::move(s)) {};

    const Store& store() const {
        return my_store;
    }

public:
    JsFakeInt js_num_references() const {
        return int2js(my_store.num_references());
    }
};

SingleppIntegratedReferences js_integrate_singlepp_references(
    JsFakeInt nref_raw, 
    JsFakeInt intersection_sizes_raw,
    JsFakeInt test_feature_ids_raw,
    JsFakeInt ref_feature_ids_raw,
    JsFakeInt refs_raw, 
    JsFakeInt built_raw,
    JsFakeInt nthreads_raw
) {
    const auto nref = js2int<std::size_t>(nref_raw);
    auto tid_ptrs = convert_array_of_offsets<const std::int32_t*>(nref, test_feature_ids_raw);
    auto rid_ptrs = convert_array_of_offsets<const std::int32_t*>(nref, ref_feature_ids_raw);

    const auto intersection_sizes = js2int<std::uintptr_t>(intersection_sizes_raw);
    auto inter_ptr = reinterpret_cast<const std::int32_t*>(intersection_sizes);
    auto all_inter = sanisizer::create<std::vector<singlepp::Intersection<std::int32_t> > >(nref);
    for (I<decltype(nref)> r = 0; r < nref; ++r) {
        auto& inter = all_inter[r];
        auto num_intersected = inter_ptr[r];
        inter.reserve(num_intersected);
        auto tptr = tid_ptrs[r];
        auto rptr = rid_ptrs[r];
        for (I<decltype(num_intersected)> i = 0; i < num_intersected; ++i) {
            inter.emplace_back(tptr[i], rptr[i]);
        }
    }

    auto ref_ptrs = convert_array_of_offsets<const SingleppRawReference*>(nref, refs_raw);
    auto blt_ptrs = convert_array_of_offsets<const SingleppTrainedReference*>(nref, built_raw);
    auto prepared = sanisizer::create<std::vector<singlepp::TrainIntegratedInput<double, std::int32_t, std::int32_t> > >(nref);
    for (I<decltype(nref)> r = 0; r < nref; ++r) {
        const auto& mat = ref_ptrs[r]->matrix();
        const auto& trained = blt_ptrs[r]->store();
        if (!sanisizer::is_equal(mat.ncol(), trained.num_profiles())) {
            throw std::runtime_error("mismatch in the number of profiles for reference " + std::to_string(r));
        }
        if (!sanisizer::is_equal(ref_ptrs[r]->markers().size(), trained.num_labels())) {
            throw std::runtime_error("mismatch in the number of labels for reference " + std::to_string(r));
        }
        prepared[r] = singlepp::prepare_integrated_input_intersect(
            all_inter[r],
            mat,
            ref_ptrs[r]->labels().data(),
            trained
        );
    }

    singlepp::TrainIntegratedOptions topt;
    topt.num_threads = js2int<int>(nthreads_raw);
    auto store = singlepp::train_integrated(std::move(prepared), topt);
    return SingleppIntegratedReferences(std::move(store));
}

/*****************************************/

class SingleppIntegratedResults {
private:
    typedef singlepp::ClassifyIntegratedResults<std::int32_t, double> Store;

    Store my_store;

public:
    SingleppIntegratedResults(Store s) : my_store(std::move(s)) {}

    const Store& store() const {
        return my_store;
    }

public:
    JsFakeInt js_num_samples() const {
        return int2js(my_store.best.size());
    }

    JsFakeInt js_num_references() const {
        return int2js(my_store.scores.size());
    }

    emscripten::val js_best() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.best.size(), my_store.best.data()));
    }

    void js_score_for_sample(JsFakeInt i_raw, JsFakeInt output_raw) const {
        const auto i = js2int<std::size_t>(i_raw);
        const auto output = js2int<std::uintptr_t>(output_raw);
        auto optr = reinterpret_cast<double*>(output);
        for (auto& s : my_store.scores) {
            *optr = s[i];
            ++optr;
        }
    }

    emscripten::val js_score_for_reference(JsFakeInt i_raw) const {
        const auto& current = my_store.scores[js2int<std::size_t>(i_raw)];
        return emscripten::val(emscripten::typed_memory_view(current.size(), current.data()));
    }

    emscripten::val js_delta() const {
        return emscripten::val(emscripten::typed_memory_view(my_store.delta.size(), my_store.delta.data()));
    }
};

SingleppIntegratedResults js_integrate_singlepp(
    const NumericMatrix& mat,
    JsFakeInt assigned_raw,
    const SingleppIntegratedReferences& integrated,
    double quantile,
    JsFakeInt nthreads_raw
) {
    singlepp::ClassifyIntegratedOptions<double> opt;
    opt.quantile = quantile;
    opt.num_threads = js2int<int>(nthreads_raw);
    auto ass_ptrs = convert_array_of_offsets<const std::int32_t*>(integrated.store().num_references(), assigned_raw);
    auto store = singlepp::classify_integrated(*mat, ass_ptrs, integrated.store(), opt);
    return SingleppIntegratedResults(std::move(store));
}

/*****************************************/

EMSCRIPTEN_BINDINGS(run_singlepp) {
    emscripten::class_<SingleppRawReference>("SingleppRawReference")
        .function("num_samples", &SingleppRawReference::js_num_samples, emscripten::return_value_policy::take_ownership())
        .function("num_features", &SingleppRawReference::js_num_features, emscripten::return_value_policy::take_ownership())
        .function("num_labels", &SingleppRawReference::js_num_labels, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("load_singlepp_reference", &js_load_singlepp_reference, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SingleppTrainedReference>("SingleppTrainedReference")
        .function("num_features", &SingleppTrainedReference::js_num_features, emscripten::return_value_policy::take_ownership())
        .function("num_labels", &SingleppTrainedReference::js_num_labels, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("train_singlepp_reference", &js_train_singlepp_reference, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SingleppResults>("SingleppResults")
        .function("num_samples", &SingleppResults::js_num_samples, emscripten::return_value_policy::take_ownership()) 
        .function("num_labels", &SingleppResults::js_num_labels, emscripten::return_value_policy::take_ownership())
        .function("best", &SingleppResults::js_best, emscripten::return_value_policy::take_ownership())
        .function("score_for_sample", &SingleppResults::js_score_for_sample, emscripten::return_value_policy::take_ownership())
        .function("score_for_label", &SingleppResults::js_score_for_label, emscripten::return_value_policy::take_ownership())
        .function("delta", &SingleppResults::js_delta, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("run_singlepp", &js_run_singlepp, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SingleppIntegratedReferences>("SingleppIntegratedReferences")
        .function("num_references", &SingleppIntegratedReferences::js_num_references, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("integrate_singlepp_references", &js_integrate_singlepp_references, emscripten::return_value_policy::take_ownership());

    emscripten::class_<SingleppIntegratedResults>("SingleppIntegratedResults")
        .function("num_samples", &SingleppIntegratedResults::js_num_samples, emscripten::return_value_policy::take_ownership()) 
        .function("num_references", &SingleppIntegratedResults::js_num_references, emscripten::return_value_policy::take_ownership())
        .function("best", &SingleppIntegratedResults::js_best, emscripten::return_value_policy::take_ownership())
        .function("score_for_sample", &SingleppIntegratedResults::js_score_for_sample, emscripten::return_value_policy::take_ownership())
        .function("score_for_reference", &SingleppIntegratedResults::js_score_for_reference, emscripten::return_value_policy::take_ownership())
        .function("delta", &SingleppIntegratedResults::js_delta, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("integrate_singlepp", &js_integrate_singlepp, emscripten::return_value_policy::take_ownership());
}
