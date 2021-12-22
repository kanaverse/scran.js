#include <emscripten.h>
#include <emscripten/bind.h>

#include "utils.h"
#include "NumericMatrix.h"

#ifdef PROGRESS_PRINTER
#define TATAMI_PROGRESS_PRINTER(name, state, total, message) PROGRESS_PRINTER(name, state, total, message)
#endif

#include "tatami/ext/MatrixMarket.hpp"

/**
 * Read a (possibly compressed) Matrix Market file into a sparse `NumericMatrix` object.
 * The file should only contain non-negative integer values.
 *
 * @param buffer Offset to a unsigned 8-bit integer array of length `size`,
 * containing the byte contents of the file.
 * @param size Length of the array referenced by `buffer`.
 * @param compressed Whether the file is Gzip-compressed.
 *
 * @return A `NumericMatrix` object containing the file contents.
 */
NumericMatrix read_matrix_market(uintptr_t buffer, int size, bool compressed) {
#ifdef PROGRESS_PRINTER
    PROGRESS_PRINTER("read_matrix_market", 1, 2, "Loading Matrix Market file")
#endif 

    unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
    if (compressed) {
        auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix_from_buffer_gzip(bufptr, size);

#ifdef PROGRESS_PRINTER
        PROGRESS_PRINTER("read_matrix_market", 2, 2, "Done")
#endif

        return NumericMatrix(std::move(stuff.matrix), std::move(stuff.permutation));
    } else {
        auto stuff = tatami::MatrixMarket::load_layered_sparse_matrix_from_buffer(bufptr, size);

#ifdef PROGRESS_PRINTER
        PROGRESS_PRINTER("read_matrix_market", 2, 2, "Done")
#endif

        return NumericMatrix(std::move(stuff.matrix), std::move(stuff.permutation));
    }
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(read_matrix_market) {
    emscripten::function("read_matrix_market", &read_matrix_market);
}
/**
 * @endcond
 */
