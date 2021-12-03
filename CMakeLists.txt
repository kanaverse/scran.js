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
    target_compile_definitions(scran_wasm PRIVATE USE_NODE_FS=1)
    set_property(TARGET scran_wasm APPEND PROPERTY LINK_FLAGS "-lnode.js")
endif()
