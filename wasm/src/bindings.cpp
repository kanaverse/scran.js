#include <emscripten/bind.h>
#include "NumericMatrix.h"
#include "JSVector.h"

EMSCRIPTEN_BINDINGS(my_class_example) {
    emscripten::class_<NumericMatrix>("NumericMatrix")
        .constructor<int, int, uintptr_t>()
        .function("nrow", &NumericMatrix::nrow)
        .function("ncol", &NumericMatrix::ncol)
        .function("row", &NumericMatrix::row)
        .function("column", &NumericMatrix::column)
        ;
}
