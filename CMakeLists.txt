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
    src/read_hdf5_matrix.cpp
    src/hdf5_utils.cpp
    src/initialize_sparse_matrix.cpp
    src/per_cell_qc_metrics.cpp
    src/per_cell_adt_qc_metrics.cpp
    src/per_cell_qc_filters.cpp
    src/per_cell_adt_qc_filters.cpp
    src/filter_cells.cpp
    src/log_norm_counts.cpp
    src/median_size_factors.cpp
    src/grouped_size_factors.cpp
    src/model_gene_var.cpp
    src/run_pca.cpp
    src/run_tsne.cpp
    src/run_umap.cpp
    src/mnn_correct.cpp
    src/scale_by_neighbors.cpp
    src/cluster_snn_graph.cpp
    src/cluster_kmeans.cpp
    src/score_markers.cpp
    src/run_singlepp.cpp
    src/NumericMatrix.cpp
    src/NeighborIndex.cpp
    src/cbind.cpp
    src/subset.cpp
    src/delayed.cpp
    src/get_error_message.cpp
    src/rds_utils.cpp
    src/initialize_from_rds.cpp
)

target_compile_options(
    scran_wasm PUBLIC -O3 -s USE_PTHREADS=1
)

target_link_libraries(
    scran_wasm
    scran
    mnncorrect
    qdtsne
    umappp
    hdf5-wasm-cpp
    singlepp
    rds2cpp
)

target_compile_definitions(scran_wasm PRIVATE TATAMI_USE_ZLIB=1)

target_link_options(scran_wasm PRIVATE 
    -O3 
    --bind 
    -sALLOW_MEMORY_GROWTH=1 
    -sMAXIMUM_MEMORY=4GB 
    -sUSE_ZLIB=1 
    -sMODULARIZE=1 
    -sEXPORT_NAME=loadScran 
    -sFORCE_FILESYSTEM=1 # for HDF5 file access.
    -sEXPORT_ES6
)

set_target_properties(scran_wasm PROPERTIES OUTPUT_NAME scran)

set(COMPILE_NODE OFF CACHE BOOL "Compile for Node.js")
if (COMPILE_NODE)
    target_link_options(scran_wasm PRIVATE
        -sENVIRONMENT=node 
        -sNODERAWFS=1
    )

    add_custom_command(TARGET scran_wasm POST_BUILD
        COMMAND cat ../misc/preamble.js scran.js > tmp.js
        COMMAND mv tmp.js scran.js
        COMMAND cat ../misc/preamble.js scran.worker.js > tmp.js
        COMMAND mv tmp.js scran.worker.js
        WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
        COMMENT "Adding ES6 preamble for Node"
    )
else ()
    target_link_options(scran_wasm PRIVATE 
        -s ENVIRONMENT=web,worker 
        -s 'EXPORTED_RUNTIME_METHODS=["FS"]'
    )
endif()

set(COMPILE_PTHREADS ON CACHE BOOL "Compile with pthreads")
if (COMPILE_PTHREADS)
    set_property(TARGET scran_wasm APPEND APPEND_STRING PROPERTY LINK_FLAGS " -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=\"Module.scran_custom_nthreads\"")
endif()
