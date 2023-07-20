#ifndef PARALLEL_H
#define PARALLEL_H

#ifdef __EMSCRIPTEN_PTHREADS__
#include <thread>
#include <cmath>
#include <vector>

template<class Function_, typename Index_>
void run_parallel_new(Function_ fun, Index_ njobs, int nthreads) {
    if (nthreads == 1) {
        fun(0, 0, njobs);
        return;
    }

    Index_ jobs_per_worker = njobs/nthreads + (njobs % nthreads > 0);
    std::vector<std::thread> workers;
    workers.reserve(nthreads);
    Index_ first = 0;

    for (int w = 0; w < nthreads && first < njobs; ++w) {
        int len = std::min(jobs_per_worker, njobs - first);
        workers.emplace_back(fun, w, first, len);
        first += jobs_per_worker;
    }

    for (auto& wrk : workers) {
        wrk.join();
    }
}

template<typename Index_, class Function_>
void run_parallel_old(Index_ njobs, Function_ fun, size_t nthreads) {
    if (nthreads == 1) {
        fun(0, njobs);
        return;
    }

    Index_ jobs_per_worker = njobs/nthreads + (njobs % nthreads > 0);
    std::vector<std::thread> workers;
    workers.reserve(nthreads);
    int first = 0;

    for (int w = 0; w < nthreads && first < njobs; ++w) {
        int last = first + std::min(jobs_per_worker, njobs - first);
        workers.emplace_back(fun, first, last);
        first += jobs_per_worker;
    }

    for (auto& wrk : workers) {
        wrk.join();
    }
}

template<class Function_>
void run_parallel_simple(int nthreads, Function_ fun) {
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

#define TATAMI_CUSTOM_PARALLEL run_parallel_new
#define IRLBA_CUSTOM_PARALLEL run_parallel_simple
#define KMEANS_CUSTOM_PARALLEL run_parallel_old
#define SCRAN_CUSTOM_PARALLEL run_parallel_new
#define MNNCORRECT_CUSTOM_PARALLEL run_parallel_old
#define QDTSNE_CUSTOM_PARALLEL run_parallel_old
#define UMAPPP_CUSTOM_PARALLEL run_parallel_old

#endif
#endif
