#include <emscripten/bind.h>

#include "NumericMatrix.h"

#define SINGLEPP_USE_ZLIB
#include "singlepp/SinglePP.hpp"
#include "singlepp/load_references.hpp"

#include "tatami/tatami.hpp"
#include <vector>
#include <string>
#include <unordered_map>
#include <memory>

/**
 * @brief A reference dataset for **singlepp** annotation.
 */
class SinglePPReference {
public:
    /**
     * @cond
     */
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
    /**
     * @endcond
     */

    /**
     * @return Number of samples in this reference dataset.
     */
    size_t num_samples() const {
        return matrix->ncol();
    }

    /**
     * @return Number of features in this reference dataset.
     */
    size_t num_features() const {
        return matrix->nrow();
    }

    /**
     * @return Number of labels in this reference dataset.
     */
    size_t num_labels() const {
        return markers.size();
    }
};

/**
 * @param nfeatures Number of features in the reference dataset.
 * @param[in] labels_buffer Offset to an unsigned 8-bit integer array holding a Gzipped file of labels.
 * @param labels_len Length of the array in `labels_buffer`.
 * @param[in] markers_buffer Offset to an unsigned 8-bit integer array holding a Gzipped file of marker lists.
 * @param markers_len Length of the array in `markers_buffer`.
 * @param[in] rankings_buffer Offset to an unsigned 8-bit integer array holding a Gzipped file with the ranking matrix.
 * @param rankings_len Length of the array in `rankings_buffer`.
 *
 * @return A `SinglePPReference` object containing the reference dataset.
 *
 * See the documentation at https://github.com/clusterfork/singlepp-references for details on the expected format of each file.
 */
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

/**
 * @brief A built reference dataset for **singlepp** annotation.
 */
class BuiltSinglePPReference {
public:
    /**
     * @cond
     */
    BuiltSinglePPReference(singlepp::SinglePP::PrebuiltIntersection b) : built(std::move(b)) {}

    singlepp::SinglePP::PrebuiltIntersection built;
    /**
     * @endcond
     */

    /**
     * @return Number of shared features between the test and reference datasets.
     */
    size_t shared_features() const {
        return built.mat_subset.size();
    }

    /**
     * @return Number of available labels in the reference.
     */
    size_t num_labels() const {
        return built.markers.size();
    }
};

/**
 * @param ngenes Total number of genes in the test dataset.
 * @param ref The reference dataset to use for annotation, see `load_singlepp_reference()`.
 * @param[in] mat_id Offset to an integer array of length equal to `ngenes`.
 * Each element contains a feature identifier for the corresponding row.
 * @param[in] ref_id Offset to an integer array of length equal to the number of features in the reference dataset.
 * This should contain the feature identifier for each feature in the reference, to be intersected with those in `mat_id`.
 * @param top Number of top marker genes to use from each pairwise comparison between labels.
 *
 * @return A `BuiltSinglePPReference` object that can be immediately used for classification of any matrix with row identities corresponding to `mat_id`.
 */
BuiltSinglePPReference build_singlepp_reference(size_t ngenes, const SinglePPReference& ref, uintptr_t mat_id, uintptr_t ref_id, int top) {
    singlepp::SinglePP runner;
    runner.set_top(top);
    auto built = runner.build(
        ngenes, 
        reinterpret_cast<const int*>(mat_id), 
        ref.matrix.get(), 
        reinterpret_cast<const int*>(ref_id),
        ref.labels.data(),
        ref.markers
    );
    return BuiltSinglePPReference(std::move(built));
}

/**
 * @param mat Matrix containing the test dataset, with cells in columns and features in rows.
 * @param built The pre-built reference dataset to use for annotation, see `build_singlepp_reference()`.
 * @param quantile Quantile on the correlations to use when computing a score for each label.
 * @param[out] output Offset to an integer array of length equal to the number of columns in `mat`.
 * This will be filled with the index of the assigned label for each cell in the test dataset.
 *
 * @return `output` is filled with the label assignments from the reference dataset.
 */
void run_singlepp(const NumericMatrix& mat, const BuiltSinglePPReference& built, double quantile, uintptr_t output) {
    std::vector<double*> empty(built.num_labels(), nullptr);
    singlepp::SinglePP runner;
    runner.set_quantile(quantile);
    runner.run(
        mat.ptr.get(), 
        built.built,
        reinterpret_cast<int*>(output),
        empty,
        nullptr
    );
    return;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(run_singlepp) {
    emscripten::function("run_singlepp", &run_singlepp);

    emscripten::function("load_singlepp_reference", &load_singlepp_reference);

    emscripten::function("build_singlepp_reference", &build_singlepp_reference);
    
    emscripten::class_<SinglePPReference>("SinglePPReference")
        .function("num_samples", &SinglePPReference::num_samples)
        .function("num_features", &SinglePPReference::num_features)
        .function("num_labels", &SinglePPReference::num_labels)
        ;

    emscripten::class_<BuiltSinglePPReference>("BuiltSinglePPReference")
        .function("shared_features", &BuiltSinglePPReference::shared_features)
        .function("num_labels", &BuiltSinglePPReference::num_labels)
        ;
}
/**
 * @endcond
 */
