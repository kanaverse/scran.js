#include "parallel.h"
#include "emscripten.h"

EM_JS(int, find_num_threads, (), {
    return Math.max(PThread.unusedWorkers.length, 1);
});
