#include <emscripten/bind.h>

#include "knncolle/knncolle.hpp"
#include "NeighborIndex.h"

/**
 * @param[in] mat An offset to a 2D array with dimensions (e.g., principal components) in rows and cells in columns.
 * @param nr Number of rows in `mat`.
 * @param nc Number of columns in `mat`.
 * @param approximate Whether to use an approximate neighbor search.
 *
 * @return A `NeighborIndex` object that can be passed to functions needing to perform a nearest-neighbor search.
 */
NeighborIndex build_neighbor_index(uintptr_t mat, int nr, int nc, bool approximate) {
    NeighborIndex output;
    const double* ptr = reinterpret_cast<const double*>(mat);
    if (approximate) {
        output.search.reset(new knncolle::AnnoyEuclidean<>(nr, nc, ptr));
    } else {
        output.search.reset(new knncolle::VpTreeEuclidean<>(nr, nc, ptr));
    }
    return output;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(build_neighbor_index) {
    emscripten::function("build_neighbor_index", &build_neighbor_index);
}
/**
 * @endcond
 */
