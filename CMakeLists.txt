cmake_minimum_required(VERSION 3.14)

project(scran_wasm
    VERSION 1.0.0
    DESCRIPTION "Methods for single-cell RNA-seq data analysis"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

add_subdirectory(extern)

add_executable(
    scran_wasm 
    src/read_matrix_market.cpp
    src/per_cell_qc_metrics.cpp
    src/per_cell_qc_filters.cpp
    src/filter_cells.cpp
    src/log_norm_counts.cpp
    src/model_gene_var.cpp
    src/run_pca.cpp
    src/run_tsne.cpp
    src/run_umap.cpp
    src/cluster_snn_graph.cpp
    src/score_markers.cpp
    src/NumericMatrix.cpp
    src/NeighborIndex.cpp
)

target_compile_options(
    scran_wasm PUBLIC -O2 -s USE_PTHREADS=1
)

target_link_libraries(
    scran_wasm
    scran
    qdtsne
    umappp
)

target_compile_definitions(scran_wasm PRIVATE TATAMI_USE_ZLIB=1)

set_target_properties(scran_wasm PROPERTIES 
    OUTPUT_NAME scran
    LINK_FLAGS "--bind -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB -s FORCE_FILESYSTEM=1 -s USE_ZLIB=1 -s SINGLE_FILE=1"
)

set(COMPILE_NODE OFF CACHE BOOL "Compile for Node.js")
if (COMPILE_NODE)
    set_property(TARGET scran_wasm APPEND APPEND_STRING PROPERTY LINK_FLAGS " -s WASM_ASYNC_COMPILATION=0 -s ENVIRONMENT=node")
else ()
    set_property(TARGET scran_wasm APPEND APPEND_STRING PROPERTY LINK_FLAGS " -s ENVIRONMENT=web,worker")
endif()

set(COMPILE_PTHREADS ON CACHE BOOL "Compile with pthreads")
if (COMPILE_PTHREADS)
    if (COMPILE_NODE)
        set(EM_NTHREADS "Math.ceil(require('os').cpus().length*2/3)")
    else()
        set(EM_NTHREADS "Math.ceil(navigator.hardwareConcurrency*2/3)")
    endif()

    set_property(TARGET scran_wasm APPEND APPEND_STRING PROPERTY LINK_FLAGS " -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=\"${EM_NTHREADS}\"")
    target_sources(scran_wasm PRIVATE src/parallel.cpp)
    set_property(SOURCE src/parallel.cpp PROPERTY COMPILE_DEFINITIONS EMSCRIPTEN_NUM_THREADS_EXPRESSION="${EM_NTHREADS}")
endif()
