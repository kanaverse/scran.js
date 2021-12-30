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
class Reference {
public:
    /**
     * @cond
     */
    Reference(
        size_t nfeat,
        std::vector<int> rankings,
        singlepp::Markers marks,
        std::vector<int> labs) : 
        markers(std::move(marks)),
        labels(std::move(labs))
    {
        size_t nprof = labels.size();
        matrix.reset(new tatami::DenseColumnMatrix<double, int, std::vector<int> >(nfeat, nprof, std::move(rankings)));

    }

    std::shared_ptr<tatami::NumericMatrix> matrix;
    singlepp::Markers markers;
    std::vector<int> labels;
    /**
     * @endcond
     */
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
 * @return A `Reference` object containing the reference dataset.
 *
 * See the documentation at https://github.com/clusterfork/singlepp-references for details on the expected format of each file.
 */
Reference load_reference(
    size_t nfeatures,
    uintptr_t labels_buffer, size_t labels_len,
    uintptr_t markers_buffer, size_t markers_len,
    uintptr_t rankings_buffer, size_t rankings_len)
{ 
    auto lab = singlepp::load_labels_from_zlib_buffer(reinterpret_cast<unsigned char*>(labels_buffer), labels_len);
    size_t nlabels = (lab.size() ? *std::max_element(lab.begin(), lab.end()) + 1 : 0);
    auto mark = singlepp::load_markers_from_zlib_buffer(reinterpret_cast<unsigned char*>(markers_buffer), markers_len, nfeatures, nlabels);
    auto rank = singlepp::load_rankings_from_zlib_buffer(reinterpret_cast<unsigned char*>(rankings_buffer), rankings_len, nfeatures, lab.size());
    return Reference(nfeatures, std::move(rank), std::move(mark), lab);
}

/**
 * @param mat Matrix containing the test dataset, with cells in columns and features in rows.
 * @param[in] mat_id Offset to an integer array of length equal to the number of rows in `mat`,
 * Each element contains a feature identifier for the corresponding row.
 * @param ref The reference dataset to use for annotation.
 * @param[in] ref_id Offset to an integer array of length equal to the number of features in the reference dataset.
 * This should contain the feature identifier for each feature in the reference, to be intersected with those in `mat_id`.
 * @param[out] output Offset to an integer array of length equal to the number of columns in `mat`.
 * This will be filled with the index of the assigned label for each cell in the test dataset.
 *
 * @return `output` is filled with the label assignments from the reference dataset.
 */
void run_singlepp(const NumericMatrix& mat, uintptr_t mat_id, const Reference& ref, uintptr_t ref_id, uintptr_t output) {
    std::vector<double*> empty(ref.markers.size(), nullptr);

    singlepp::SinglePP runner;
    runner.run(mat.ptr.get(), 
        reinterpret_cast<const int*>(mat_id), 
        ref.matrix.get(), 
        reinterpret_cast<const int*>(ref_id),
        ref.labels.data(),
        ref.markers,
        reinterpret_cast<int*>(output),
        empty,
        nullptr
    );
    
    return;
}

EMSCRIPTEN_BINDINGS(run_singlepp) {
    emscripten::function("run_singlepp", &run_singlepp);

    emscripten::function("load_reference", &load_reference);
    
    emscripten::class_<Reference>("Reference");
}

