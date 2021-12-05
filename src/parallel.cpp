#include "parallel.h"
#include "emscripten.h"

EM_JS(int, find_num_threads, (), {
    return EMSCRIPTEN_NUM_THREADS_EXPRESSION;
});
