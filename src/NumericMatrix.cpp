#include <emscripten/bind.h>

#include "NumericMatrix.h"

EMSCRIPTEN_BINDINGS(NumericMatrix) {
    emscripten::class_<NumericMatrix>("NumericMatrix")
        .function("nrow", &NumericMatrix::js_nrow, emscripten::return_value_policy::take_ownership())
        .function("ncol", &NumericMatrix::js_ncol, emscripten::return_value_policy::take_ownership())
        .function("row", &NumericMatrix::js_row, emscripten::return_value_policy::take_ownership())
        .function("column", &NumericMatrix::js_column, emscripten::return_value_policy::take_ownership())
        .function("sparse", &NumericMatrix::js_sparse, emscripten::return_value_policy::take_ownership())
        .function("clone", &NumericMatrix::js_clone, emscripten::return_value_policy::take_ownership())
        ;
}
