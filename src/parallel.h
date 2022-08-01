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


#define TATAMI_CUSTOM_PARALLEL run_parallel
#define IRLBA_CUSTOM_PARALLEL run_parallel2
#define KMEANS_CUSTOM_PARALLEL run_parallel
#define SCRAN_CUSTOM_PARALLEL run_parallel
#define MNNCORRECT_CUSTOM_PARALLEL run_parallel
#define QDTSNE_CUSTOM_PARALLEL run_parallel
#define UMAPPP_CUSTOM_PARALLEL run_parallel

#endif
#endif
