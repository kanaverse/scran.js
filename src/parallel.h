#ifndef PARALLEL_H
#define PARALLEL_H

#ifdef __EMSCRIPTEN_PTHREADS__
#include <thread>
#include <cmath>
#include <vector>

extern "C" {
    
int find_num_threads();

}

template<class Function>
void run_parallel(int total, Function fun) {
    int nworkers = find_num_threads();
    int jobs_per_worker = std::ceil(static_cast<double>(total)/nworkers);
    std::vector<std::thread> workers;
    workers.reserve(nworkers);
    int first = 0;

    for (int w = 0; w < nworkers && first < total; ++w, first += jobs_per_worker) {
        int last = std::min(first + jobs_per_worker, total);
        workers.emplace_back(fun, first, last);
    }

    for (auto& wrk : workers) {
        wrk.join();
    }
}

#define TATAMI_CUSTOM_PARALLEL run_parallel

#endif
#endif
