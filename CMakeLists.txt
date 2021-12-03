cmake_minimum_required(VERSION 3.14)

project(scran_wasm
    VERSION 1.0.0
    DESCRIPTION "Methods for single-cell RNA-seq data analysis"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

# Emscripten downloads the zlib headers for easy inclusion, but only after the
# first use of USE_ZLIB=1. On a pristine system, these headers won't be
# available for creation of the emcc'd object files. As such,we have to arrange
# for them to be downloaded first by calling emcc manually.
include(CheckIncludeFiles)
check_include_files(zlib.h HAVE_ZLIB_H)
if (HAVE_ZLIB_H)
    execute_process(COMMAND touch ${CMAKE_CURRENT_BINARY_DIR}/dummy.cpp)
    execute_process(COMMAND ${CMAKE_CXX_COMPILER} ${CMAKE_CURRENT_BINARY_DIR}/dummy.cpp -s USE_ZLIB=1 -o ${CMAKE_CURRENT_BINARY_DIR}/dummy.html)
endif()

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
)

target_compile_options(
    scran_wasm PUBLIC "-O2"
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
    LINK_FLAGS "--bind -O2 -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB -s FORCE_FILESYSTEM=1 -s USE_ZLIB=1"
)

set(COMPILE_NODE OFF CACHE BOOL "Compile for Node.js")
if (NOT COMPILE_NODE)
    set_property(TARGET scran_wasm APPEND PROPERTY LINK_FLAGS "-lworkerfs.js")
else()
    set_property(TARGET scran_wasm APPEND PROPERTY LINK_FLAGS "-lnode.js")
endif()

