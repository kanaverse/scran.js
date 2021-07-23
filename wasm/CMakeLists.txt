cmake_minimum_required(VERSION 3.14)

project(scran_wasm
    VERSION 1.0.0
    DESCRIPTION "Methods for single-cell RNA-seq data analysis"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

# Emscripten downloads the zlib headers for easy inclusion, but only after the
# first use of USE_ZLIB=1. On a pristine system, these headers won't be
# available for creation of the emcc'd object files. As such,we have to arrange
# for them to be downloaded externally.
include(CheckIncludeFiles)
check_include_files(zlib.h HAVE_ZLIB_H)

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
    src/cluster_snn_graph.cpp
    src/NumericMatrix.cpp
)

target_link_libraries(
    scran_wasm
    scran
)

target_compile_definitions(scran_wasm PRIVATE TATAMI_USE_ZLIB=1)
if (NOT HAVE_ZLIB_H) 
    target_link_libraries(scran_wasm zlib)
endif()

set_target_properties(scran_wasm PROPERTIES LINK_FLAGS "--bind -s ALLOW_MEMORY_GROWTH=1 -s FORCE_FILESYSTEM=1 -s USE_ZLIB=1")
