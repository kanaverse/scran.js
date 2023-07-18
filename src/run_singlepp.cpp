#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "utils.h"
#include "parallel.h"

#define SINGLEPP_USE_ZLIB
#include "singlepp/singlepp.hpp"
#include "singlepp/load_references.hpp"

#include "tatami/tatami.hpp"
#include <vector>
#include <memory>
#include <cstdint>

/*****************************************/

class SinglePPReference {
public:
    SinglePPReference(
        std::shared_ptr<tatami::NumericMatrix> ranks,
        singlepp::Markers marks,
        std::vector<int> labs) :
        matrix(std::move(ranks)),
        markers(std::move(marks)),
        labels(std::move(labs))
    {}

    SinglePPReference() {};

    std::shared_ptr<tatami::NumericMatrix> matrix;
    singlepp::Markers markers;
    std::vector<int> labels;

public:
    size_t num_samples() const {
        return matrix->ncol();
    }

    size_t num_features() const {
        return matrix->nrow();
    }

    size_t num_labels() const {
        return markers.size();
    }
};

SinglePPReference load_singlepp_reference(
    uintptr_t labels_buffer, size_t labels_len,
    uintptr_t markers_buffer, size_t markers_len,
    uintptr_t rankings_buffer, size_t rankings_len)
{ 
    auto lab = singlepp::load_labels_from_zlib_buffer(reinterpret_cast<unsigned char*>(labels_buffer), labels_len);
    size_t nlabels = (lab.size() ? *std::max_element(lab.begin(), lab.end()) + 1 : 0);

    auto mat = singlepp::load_rankings_from_zlib_buffer(reinterpret_cast<unsigned char*>(rankings_buffer), rankings_len);
    std::shared_ptr<tatami::NumericMatrix> rank(new decltype(mat)(std::move(mat)));

    auto mark = singlepp::load_markers_from_zlib_buffer(reinterpret_cast<unsigned char*>(markers_buffer), markers_len, rank->nrow(), nlabels);

    return SinglePPReference(std::move(rank), std::move(mark), std::move(lab));
}

/*****************************************/

class BuiltSinglePPReference {
public:
    BuiltSinglePPReference(singlepp::BasicBuilder::PrebuiltIntersection b) : built(std::move(b)) {}

    singlepp::BasicBuilder::PrebuiltIntersection built;

public:
    size_t shared_features() const {
        return built.mat_subset.size();
    }

    size_t num_labels() const {
        return built.markers.size();
    }
};

BuiltSinglePPReference build_singlepp_reference(size_t nfeatures, uintptr_t mat_id, const SinglePPReference& ref, uintptr_t ref_id, int top, int nthreads) {
    singlepp::BasicBuilder builder;
    builder.set_top(top).set_num_threads(nthreads);

    auto built = builder.run(
        nfeatures, 
        reinterpret_cast<const int*>(mat_id), 
        ref.matrix.get(), 
        reinterpret_cast<const int*>(ref_id),
        ref.labels.data(),
        ref.markers
    );
    return BuiltSinglePPReference(std::move(built));
}

/*****************************************/

struct SinglePPResults {
    std::vector<int> best;
    std::unique_ptr<tatami::DenseColumnMatrix<double, int> > scores;
    std::vector<double> delta;

    int num_samples() const {
        return scores->nrow();
    }

    int num_labels() {
        return scores->ncol();
    }

    emscripten::val get_best() const {
        return emscripten::val(emscripten::typed_memory_view(best.size(), best.data()));
    }

    void get_scores_for_sample(int i, uintptr_t output) {
        auto optr = reinterpret_cast<double*>(output);
        scores->dense_row()->fetch_copy(i, optr);
    }

    void get_scores_for_label(int i, uintptr_t output) {
        auto optr = reinterpret_cast<double*>(output);
        scores->dense_column()->fetch_copy(i, optr);
    }

    emscripten::val get_delta() const {
        return emscripten::val(emscripten::typed_memory_view(best.size(), best.data()));
    }
};

SinglePPResults run_singlepp(const NumericMatrix& mat, const BuiltSinglePPReference& built, double quantile, int nthreads) {
    size_t nlabs = built.num_labels();
    size_t NC =  mat.ptr->ncol();

    std::vector<double> scores(nlabs * NC);
    std::vector<double*> ptrs;
    ptrs.reserve(nlabs);
    for (size_t l = 0; l < nlabs; ++l) {
        ptrs.push_back(scores.data() + NC * l);
    }

    SinglePPResults output;
    output.best.resize(NC);
    output.delta.resize(NC);

    singlepp::BasicScorer runner;
    runner.set_quantile(quantile).set_num_threads(nthreads);

    runner.run(
        mat.ptr.get(), 
        built.built,
        output.best.data(),
        ptrs,
        output.delta.data()
    );

    output.scores.reset(new tatami::DenseColumnMatrix<double, int>(NC, nlabs, std::move(scores)));
    return output;
}

/*****************************************/

class IntegratedSinglePPReferences {
public:
    IntegratedSinglePPReferences(singlepp::IntegratedReferences x) : references(std::move(x)) {};

    IntegratedSinglePPReferences() {};

    singlepp::IntegratedReferences references;

    size_t num_references() const {
        return references.num_references();
    }
};

IntegratedSinglePPReferences integrate_singlepp_references(
    size_t nfeatures, 
    uintptr_t mat_id, 
    size_t nref, 
    uintptr_t refs, 
    uintptr_t ref_ids, 
    uintptr_t built,
    int nthreads) 
{
    auto mid_ptr = reinterpret_cast<const int*>(mat_id);
    auto ref_ptrs = convert_array_of_offsets<const SinglePPReference*>(nref, refs);
    auto rid_ptrs = convert_array_of_offsets<const int*>(nref, ref_ids);
    auto blt_ptrs = convert_array_of_offsets<const BuiltSinglePPReference*>(nref, built);

    singlepp::IntegratedBuilder inter;
    inter.set_num_threads(nthreads);

    for (size_t r = 0; r < nref; ++r) {
        inter.add(
            nfeatures, 
            mid_ptr,
            ref_ptrs[r]->matrix.get(),
            rid_ptrs[r],
            ref_ptrs[r]->labels.data(),
            blt_ptrs[r]->built
        );
    }

    return IntegratedSinglePPReferences(inter.finish());
}

SinglePPResults integrate_singlepp(const NumericMatrix& mat, uintptr_t assigned, const IntegratedSinglePPReferences& integrated, double quantile, int nthreads) {
    size_t nrefs = integrated.num_references();
    size_t NC =  mat.ptr->ncol();

    std::vector<double> scores(nrefs * NC);
    std::vector<double*> ptrs;
    ptrs.reserve(nrefs);
    for (size_t l = 0; l < nrefs; ++l) {
        ptrs.push_back(scores.data() + NC * l);
    }

    SinglePPResults output;
    output.best.resize(NC);
    output.delta.resize(NC);

    auto aptrs = convert_array_of_offsets<const int*>(integrated.num_references(), assigned);

    singlepp::IntegratedScorer runner;
    runner.set_quantile(quantile).set_num_threads(nthreads);

    runner.run(
        mat.ptr.get(), 
        aptrs,
        integrated.references,
        output.best.data(),
        ptrs,
        output.delta.data()
    );

    output.scores.reset(new tatami::DenseColumnMatrix<double, int>(NC, nrefs, std::move(scores)));
    return output;
}

/*****************************************/

EMSCRIPTEN_BINDINGS(run_singlepp) {
    emscripten::function("run_singlepp", &run_singlepp);

    emscripten::function("load_singlepp_reference", &load_singlepp_reference);

    emscripten::function("build_singlepp_reference", &build_singlepp_reference);

    emscripten::function("integrate_singlepp_references", &integrate_singlepp_references);

    emscripten::function("integrate_singlepp", &integrate_singlepp);
    
    emscripten::class_<SinglePPReference>("SinglePPReference")
        .function("num_samples", &SinglePPReference::num_samples)
        .function("num_features", &SinglePPReference::num_features)
        .function("num_labels", &SinglePPReference::num_labels)
        ;

    emscripten::class_<BuiltSinglePPReference>("BuiltSinglePPReference")
        .function("shared_features", &BuiltSinglePPReference::shared_features)
        .function("num_labels", &BuiltSinglePPReference::num_labels)
        ;

    emscripten::class_<IntegratedSinglePPReferences>("IntegratedSinglePPReferences")
        .function("num_references", &IntegratedSinglePPReferences::num_references)
        ;

    emscripten::class_<SinglePPResults>("SinglePPResults")
        .function("num_samples", &SinglePPResults::num_samples) 
        .function("num_labels", &SinglePPResults::num_labels)
        .function("get_best", &SinglePPResults::get_best)
        .function("get_scores_for_sample", &SinglePPResults::get_scores_for_sample)
        .function("get_scores_for_label", &SinglePPResults::get_scores_for_label)
        .function("get_delta", &SinglePPResults::get_delta)
        ;
}
