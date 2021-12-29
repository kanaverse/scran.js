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

class Reference {
public:
    Reference(
        size_t nfeat,
        std::vector<int> rankings,
        singlepp::Markers marks,
        const std::vector<std::string>& labs) : markers(std::move(marks))
    {
        size_t nprof = labs.size();
        matrix.reset(new tatami::DenseColumnMatrix<double, int, std::vector<int> >(nfeat, nprof, std::move(rankings)));

        {
            int counter = 0;
            labels.reserve(nprof);
            std::unordered_map<std::string, int> indexed;
            for (auto l : labs) {
                auto it = indexed.find(l);
                if (it != indexed.end()) {
                    labels.push_back(it->second);
                } else {
                    indexed[l] = counter;
                    labels.push_back(counter);
                    ++counter;
                }
            }

            label_names.resize(indexed.size());
            for (const auto& i : indexed) {
                label_names[i.second] = i.first;
            }
        }
    }

    std::shared_ptr<tatami::NumericMatrix> matrix;
    singlepp::Markers markers;
    std::vector<int> labels;
    std::vector<std::string> label_names;

    size_t nlabels() const {
        return label_names.size();
    }

    std::string label(int i) const {
        return label_names[i];
    }
};

Reference load_reference(
    size_t nfeatures,
    uintptr_t labels_buffer, size_t labels_len,
    uintptr_t markers_buffer, size_t markers_len,
    uintptr_t rankings_buffer, size_t rankings_len)
{ 
    auto lab = singlepp::load_labels_from_zlib_buffer(reinterpret_cast<unsigned char*>(labels_buffer), labels_len);
    auto mark = singlepp::load_markers_from_zlib_buffer(reinterpret_cast<unsigned char*>(markers_buffer), markers_len);
    auto rank = singlepp::load_rankings_from_zlib_buffer(reinterpret_cast<unsigned char*>(rankings_buffer), rankings_len, nfeatures, lab.size());
    return Reference(nfeatures, std::move(rank), std::move(mark), lab);
}

void run_singlepp(const NumericMatrix& mat, uintptr_t mat_id, const Reference& ref, uintptr_t ref_id, uintptr_t output) {
    std::vector<double*> empty(ref.nlabels(), nullptr);

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
    
    emscripten::class_<Reference>("Reference")
        .function("nlabels", &Reference::nlabels)
        .function("label", &Reference::label)
        ;
}

