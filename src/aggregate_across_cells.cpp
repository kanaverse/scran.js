#include <emscripten/bind.h>

#include <cstdint>
#include <algorithm>

#include "NumericMatrix.h"
#include "parallel.h"

#include "scran/aggregation/AggregateAcrossCells.hpp"

struct AggregateAcrossCells_Results {
    int ngenes, ngroups;
    std::vector<double> sums;
    std::vector<double> detected;

    int num_genes() const {
        return ngenes;
    }

    int num_groups() const {
        return ngroups;
    }

    emscripten::val all_sums() const {
        return emscripten::val(emscripten::typed_memory_view(sums.size(), sums.data()));
    }

    emscripten::val group_sums(int i) const {
        return emscripten::val(emscripten::typed_memory_view(ngenes, sums.data() + i * ngenes));
    }

    NumericMatrix sums_as_matrix() const {
        return NumericMatrix(new tatami::DenseColumnMatrix<double, int, tatami::ArrayView<double> >(ngenes, ngroups, tatami::ArrayView(sums.data(), sums.size())));
    }

    emscripten::val all_detected() const {
        return emscripten::val(emscripten::typed_memory_view(detected.size(), detected.data()));
    }

    emscripten::val group_detected(int i) const {
        return emscripten::val(emscripten::typed_memory_view(ngenes, detected.data() + i * ngenes));
    }

    NumericMatrix detected_as_matrix() const {
        return NumericMatrix(new tatami::DenseColumnMatrix<double, int, tatami::ArrayView<double> >(ngenes, ngroups, tatami::ArrayView(detected.data(), detected.size())));
    }
};

AggregateAcrossCells_Results aggregate_across_cells(const NumericMatrix& mat, uintptr_t factor, bool average, int nthreads) {
    auto fptr = reinterpret_cast<const int32_t*>(factor);
    size_t NR = mat.ptr->nrow();
    size_t NC = mat.ptr->ncol();
    int ngroups = (NC ? *std::max_element(fptr, fptr + NC) + 1 : 0);

    std::vector<int> sizes;
    if (average) {
        sizes.resize(ngroups);
        for (size_t c = 0; c < NC; ++c) {
            ++sizes[fptr[c]];
        }
    }

    AggregateAcrossCells_Results output;
    output.ngenes = NR;
    output.ngroups = ngroups;
    output.sums.resize(ngroups * NR);
    output.detected.resize(ngroups * NR);

    std::vector<double*> sums_ptr(ngroups), detected_ptr(ngroups);
    for (int g = 0; g < ngroups; ++g) {
        sums_ptr[g] = output.sums.data() + g * NR;
        detected_ptr[g] = output.detected.data() + g * NR;
    }

    scran::AggregateAcrossCells aggr;
    aggr.set_num_threads(nthreads);
    aggr.run(mat.ptr.get(), fptr, std::move(sums_ptr), std::move(detected_ptr));

    if (average) {
        for (int g = 0; g < ngroups; ++g) {
            auto sptr = output.sums.data() + g * NR;
            auto dptr = output.detected.data() + g * NR;
            auto n = sizes[g];
            for (size_t r = 0; r < NR; ++r) {
                sptr[r] /= n;
                dptr[r] /= n;
            }
        }
    }

    return output;
}

EMSCRIPTEN_BINDINGS(aggregate_across_cells) {
    emscripten::function("aggregate_across_cells", &aggregate_across_cells);

    emscripten::class_<AggregateAcrossCells_Results>("AggregateAcrossCells_Results")
        .function("group_sums", &AggregateAcrossCells_Results::group_sums)
        .function("all_sums", &AggregateAcrossCells_Results::all_sums)
        .function("sums_as_matrix", &AggregateAcrossCells_Results::sums_as_matrix)
        .function("group_detected", &AggregateAcrossCells_Results::group_detected)
        .function("all_detected", &AggregateAcrossCells_Results::all_detected)
        .function("detected_as_matrix", &AggregateAcrossCells_Results::detected_as_matrix)
        .function("num_genes", &AggregateAcrossCells_Results::num_genes)
        .function("num_groups", &AggregateAcrossCells_Results::num_groups)
        ;
}

