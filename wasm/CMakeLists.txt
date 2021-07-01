cmake_minimum_required(VERSION 3.14)

project(scran_wasm
    VERSION 1.0.0
    DESCRIPTION "Methods for single-cell RNA-seq data analysis"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

add_subdirectory(extern)

add_executable(
    scran_wasm 
    src/per_cell_qc_metrics.cpp
    src/per_cell_qc_filters.cpp
    src/bindings.cpp
)

target_link_libraries(
    scran_wasm
    scran
)

set_target_properties(scran_wasm PROPERTIES LINK_FLAGS "--bind")
