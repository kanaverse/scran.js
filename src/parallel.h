#ifndef PARALLEL_H
#define PARALLEL_H

#ifdef __EMSCRIPTEN_PTHREADS__
#include <thread>
#include <cmath>
#include <vector>

template<class Function>
void run_parallel(int total, Function fun, int nthreads) {
    if (nthreads == 1) {
        fun(0, total);
        return;
    }

    int jobs_per_worker = std::ceil(static_cast<double>(total)/nthreads);
    std::vector<std::thread> workers;
    workers.reserve(nthreads);
    int first = 0;

    for (int w = 0; w < nthreads && first < total; ++w, first += jobs_per_worker) {
        int last = std::min(first + jobs_per_worker, total);
        workers.emplace_back(fun, first, last);
    }

    for (auto& wrk : workers) {
        wrk.join();
    }
}

template<class Function>
void run_parallel2(int nthreads, Function fun) {
    if (nthreads == 1) {
        fun(0);
        return;
    }

    std::vector<std::thread> workers;
    workers.reserve(nthreads);

    for (int w = 0; w < nthreads; ++w) {
        workers.emplace_back(fun, w);
    }

    for (auto& wrk : workers) {
        wrk.join();
    }
}

/*
 * All of these macros are explicitly defined for safety's sake. 
 *
 * In theory, this would not be necessary as macros for libraries like scran
 * propagate to scran's dependencies like tatami, irlba, and kmeans.
 * Unfortunately, this assumes that scran is included in each compilation unit,
 * which is not currently the case. This means that certain compilation units
 * may have propagation and others may not, resulting in ODR errors.
 * 
 * You can figure out which macros need to be defined by checking the
 * dependencies in build_main/_deps; many of Aaron's libraries will support
 * some form of *_CUSTOM_PARALLEL macro.
 */

#define TATAMI_CUSTOM_PARALLEL run_parallel
#define IRLBA_CUSTOM_PARALLEL run_parallel2
#define KMEANS_CUSTOM_PARALLEL run_parallel
#define SCRAN_CUSTOM_PARALLEL run_parallel
#define MNNCORRECT_CUSTOM_PARALLEL run_parallel
#define QDTSNE_CUSTOM_PARALLEL run_parallel
#define UMAPPP_CUSTOM_PARALLEL run_parallel

#endif
#endif
