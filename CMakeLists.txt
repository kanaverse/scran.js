cmake_minimum_required(VERSION 3.14)

project(scran_wasm
    VERSION 1.0.0
    DESCRIPTION "Methods for single-cell RNA-seq data analysis"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

# Need the CMAKE_FIND_ROOT_PATH_BOTH to override Emscripten's overrides (see emscripten/issues#6595)
find_package(igraph REQUIRED CONFIG CMAKE_FIND_ROOT_PATH_BOTH)
find_package(HDF5 REQUIRED COMPONENTS C CXX CONFIG CMAKE_FIND_ROOT_PATH_BOTH)
find_package(ZLIB REQUIRED)
add_subdirectory(extern)

add_executable(
    scran_wasm 

    src/NumericMatrix.cpp
    src/cbind.cpp
    src/subset.cpp
    src/delayed.cpp
    src/matrix_stats.cpp

    src/initialize_from_arrays.cpp
    src/initialize_from_rds.cpp
    src/initialize_from_mtx.cpp
    src/initialize_from_hdf5.cpp

    src/transpose_matrix.cpp

    src/rds_utils.cpp
    src/hdf5_utils.cpp
    src/write_sparse_matrix_to_hdf5.cpp

    src/quality_control_rna.cpp
    src/quality_control_adt.cpp
    src/quality_control_crispr.cpp

    src/normalize_counts.cpp
    src/compute_clrm1_factors.cpp

    src/model_gene_variances.cpp

    src/run_pca.cpp
    src/mnn_correct.cpp
    src/scale_by_neighbors.cpp

    src/NeighborIndex.cpp

    src/run_tsne.cpp
    src/run_umap.cpp

    src/build_snn_graph.cpp
    src/cluster_graph.cpp
    src/cluster_kmeans.cpp

    src/score_markers.cpp

    src/run_singlepp.cpp

    src/score_gsdecon.cpp
    src/hypergeometric_test.cpp

    src/aggregate_across_cells.cpp

    src/get_error_message.cpp
)

target_compile_options(
    scran_wasm PUBLIC 
    -O3
    -pthread
    -sMEMORY64
)

target_link_libraries(
    scran_wasm

    tatami_hdf5
    tatami_mtx
    tatami_layered

    scran_qc
    scran_norm
    scran_variances
    scran_pca
    scran_aggregate
    scran_markers

    knncolle
    knncolle_annoy

    qdtsne
    umappp

    mumosa

    mnncorrect

    igraph::igraph
    scran_graph_cluster
    kmeans

    singlepp
    singlepp_loaders

    hdf5-static
    hdf5_cpp-static
    rds2cpp

    phyper
    gsdecon
)

target_include_directories(
    scran_wasm
    PRIVATE
    extern/include
)

target_link_options(scran_wasm PRIVATE 
    -O3
    --bind 
    -sALLOW_MEMORY_GROWTH=1 
    --minify=0
    -sMEMORY64
    -sMAXIMUM_MEMORY=16GB # current maximum, otherwise Emscripten complains.
    -sSTACK_SIZE=2MB
    -sUSE_ZLIB=1 
    -sMODULARIZE=1 
    -sEXPORT_NAME=loadScran 
    -sFORCE_FILESYSTEM=1 # for HDF5 file access.
    -sEXPORT_ES6
    -pthread
    -sPTHREAD_POOL_SIZE=Module.scran_custom_nthreads
    -sEXPORTED_FUNCTIONS=_malloc,_free
)

set_target_properties(scran_wasm PROPERTIES OUTPUT_NAME scran)

set(COMPILE_NODE OFF CACHE BOOL "Compile for Node.js")
if (COMPILE_NODE)
    # Exporting HEAP8 for compatibility with old wasmarrays.js.
    target_link_options(scran_wasm PRIVATE
        -sENVIRONMENT=node 
        -sNODERAWFS=1
        -sEXPORTED_RUNTIME_METHODS=wasmMemory,HEAP8,PThread
    )
else ()
    target_link_options(scran_wasm PRIVATE 
        -sENVIRONMENT=web,worker 
        -sEXPORTED_RUNTIME_METHODS=wasmMemory,HEAP8,PThread,FS
    )
endif()
