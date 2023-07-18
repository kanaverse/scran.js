#include <emscripten/bind.h>

#include <vector>
#include <cmath>
#include <algorithm>

#include "NumericMatrix.h"
#include "parallel.h"

#include "scran/scran.hpp"

template<class Store_>
struct AnyPca_Results {
    AnyPca_Results(Store_ s) : store(std::move(s)) {}

    Store_ store;

public:
    emscripten::val pcs() const {
        return emscripten::val(emscripten::typed_memory_view(store.pcs.cols() * store.pcs.rows(), store.pcs.data()));
    }

    emscripten::val variance_explained() const {
        return emscripten::val(emscripten::typed_memory_view(store.variance_explained.size(), store.variance_explained.data()));
    }

    double total_variance() const {
        return store.total_variance;
    }

public:
    int num_cells() const {
        return store.pcs.cols();
    }

    int num_pcs() const {
        return store.variance_explained.size();
    }
};

const uint8_t* precheck_inputs(int number, size_t NC, bool use_subset, uintptr_t subset) {
    if (number < 1) {
        throw std::runtime_error("requested number of PCs should be positive");
    }
    if (NC < number) {
        throw std::runtime_error("fewer cells than the requested number of PCs");
    }
    const uint8_t* subptr = NULL;
    if (use_subset) {
        subptr = reinterpret_cast<const uint8_t*>(subset);
    }
    return subptr;
}

using SimplePca_Results = AnyPca_Results<scran::SimplePca::Results>;

SimplePca_Results run_pca(const NumericMatrix& mat, int number, bool use_subset, uintptr_t subset, bool scale, int nthreads) {
    auto ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();

    auto subptr = precheck_inputs(number, NC, use_subset, subset);

    scran::SimplePca pca;
    pca.set_rank(number).set_scale(scale).set_num_threads(nthreads);
    auto result = pca.run(ptr.get(), subptr);

    return SimplePca_Results(std::move(result)); 
}

using ResidualPca_Results = AnyPca_Results<scran::ResidualPca::Results>;

ResidualPca_Results run_blocked_pca(const NumericMatrix& mat, int number, bool use_subset, uintptr_t subset, bool scale, uintptr_t blocks, int nthreads) {
    auto ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();

    auto subptr = precheck_inputs(number, NC, use_subset, subset);
    auto bptr = reinterpret_cast<const int32_t*>(blocks);

    scran::ResidualPca pca;
    pca.set_rank(number).set_scale(scale).set_num_threads(nthreads);
    auto result = pca.run(ptr.get(), bptr, subptr);

    return ResidualPca_Results(std::move(result)); 
}

using MultiBatchPca_Results = AnyPca_Results<scran::MultiBatchPca::Results>;

MultiBatchPca_Results run_multibatch_pca(const NumericMatrix& mat, int number, bool use_subset, uintptr_t subset, bool scale, uintptr_t blocks, int nthreads) {
    auto ptr = mat.ptr;
    auto NR = ptr->nrow();
    auto NC = ptr->ncol();

    auto subptr = precheck_inputs(number, NC, use_subset, subset);
    auto bptr = reinterpret_cast<const int32_t*>(blocks);

    scran::MultiBatchPca pca;
    pca.set_rank(number).set_scale(scale).set_num_threads(nthreads);
    auto result = pca.run(ptr.get(), bptr, subptr);

    return MultiBatchPca_Results(std::move(result)); 
}

EMSCRIPTEN_BINDINGS(run_pca) {
    emscripten::function("run_pca", &run_pca);

    emscripten::function("run_blocked_pca", &run_blocked_pca);

    emscripten::function("run_multibatch_pca", &run_multibatch_pca);

    emscripten::class_<SimplePca_Results>("SimplePca_Results")
        .function("pcs", &SimplePca_Results::pcs)
        .function("variance_explained", &SimplePca_Results::variance_explained)
        .function("total_variance", &SimplePca_Results::total_variance)
        .function("num_cells", &SimplePca_Results::num_cells)
        .function("num_pcs", &SimplePca_Results::num_pcs)
        ;

    emscripten::class_<ResidualPca_Results>("ResidualPca_Results")
        .function("pcs", &ResidualPca_Results::pcs)
        .function("variance_explained", &ResidualPca_Results::variance_explained)
        .function("total_variance", &ResidualPca_Results::total_variance)
        .function("num_cells", &ResidualPca_Results::num_cells)
        .function("num_pcs", &ResidualPca_Results::num_pcs)
        ;

    emscripten::class_<MultiBatchPca_Results>("MultiBatchPca_Results")
        .function("pcs", &MultiBatchPca_Results::pcs)
        .function("variance_explained", &MultiBatchPca_Results::variance_explained)
        .function("total_variance", &MultiBatchPca_Results::total_variance)
        .function("num_cells", &MultiBatchPca_Results::num_cells)
        .function("num_pcs", &MultiBatchPca_Results::num_pcs)
        ;
}
/**
 * @endcond
 */

