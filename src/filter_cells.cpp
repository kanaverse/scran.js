#include <emscripten/bind.h>

#include <cstdint>

#include "NumericMatrix.h"
#include "parallel.h"

#include "scran/scran.hpp"

NumericMatrix filter_cells(const NumericMatrix& mat, uintptr_t filter, bool keep) {
    scran::FilterCells filterer;
    if (keep) {
        filterer.set_retain();
    }
    return NumericMatrix(filterer.run(mat.ptr, reinterpret_cast<const uint8_t*>(filter)));
}

EMSCRIPTEN_BINDINGS(filter_cells) {
    emscripten::function("filter_cells", &filter_cells);
}
