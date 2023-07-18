cmake_minimum_required(VERSION 3.14 FATAL_ERROR)

# Emscripten downloads the zlib headers for easy inclusion, but only after the
# first use of USE_ZLIB=1. On a pristine system, these headers won't be
# available for creation of the emcc'd object files. As such,we have to arrange
# for them to be downloaded first by calling emcc manually.
include(CheckIncludeFiles)
check_include_files(zlib.h HAVE_ZLIB_H)
if (NOT HAVE_ZLIB_H)
    set(ZLIB_DIR "${CMAKE_CURRENT_BINARY_DIR}/zlib")
    file(MAKE_DIRECTORY ${ZLIB_DIR})
    execute_process(COMMAND touch dummy.cpp WORKING_DIRECTORY ${ZLIB_DIR})
    execute_process(COMMAND ${CMAKE_CXX_COMPILER} dummy.cpp -s USE_ZLIB=1 -o dummy.html WORKING_DIRECTORY ${ZLIB_DIR})
endif()

include(FetchContent)

## TATAMI RELATED CONTENT ### 
FetchContent_Declare(
  tatami_layered
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_layered
  GIT_TAG e550a305ab17461970b78bf97579cc8308b03fd5
)
FetchContent_MakeAvailable(tatami_layered)

FetchContent_Declare(
  tatami_mtx
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_mtx
  GIT_TAG bc8f647dae4ada6480ee8c785fc4663d5bbf57ca
)
FetchContent_MakeAvailable(tatami_mtx)

FetchContent_Declare(
  tatami_hdf5
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_hdf5
  GIT_TAG 20ec1fb64e0419907d3094827b5d9134854a0119
)
FetchContent_MakeAvailable(tatami_hdf5)

## Prebuilt static libraries ### 
FetchContent_Declare(
  igraph 
  URL https://github.com/kanaverse/igraph-wasm/releases/download/v0.1.2_3.1.43/igraph-0.10.6-wasm.tar.gz
  URL_HASH SHA256=7876d5a9a7603ba6720e09ee424fe770dca976e3da94297bd14c6cdd17a1fcfa
)
FetchContent_MakeAvailable(igraph)

FetchContent_Declare(
  h5wasm
  URL https://github.com/kanaverse/libhdf5-wasm/releases/download/v0.3.0_3.1.43/libhdf5-1_12_2-wasm.tar.gz
  URL_HASH SHA256=b2e58b102fe98326c77f1a160025c47a062c1a205818568680d5f5ed78df801c
)
FetchContent_MakeAvailable(h5wasm)

## Other stuff ### 
FetchContent_Declare(
  umappp 
  GIT_REPOSITORY https://github.com/LTLA/umappp
  GIT_TAG d18095ea8b6d62aa740a566411e439eaab16b71f
)
FetchContent_MakeAvailable(umappp)

FetchContent_Declare(
  scran 
  GIT_REPOSITORY https://github.com/LTLA/libscran
  GIT_TAG 62e2745d51463c364f7113eeae53b6e473e511ff
)
FetchContent_MakeAvailable(scran)

FetchContent_Declare(
  kmeans 
  GIT_REPOSITORY https://github.com/LTLA/CppKmeans
  GIT_TAG master
)
FetchContent_MakeAvailable(kmeans)

FetchContent_Declare(
  mnncorrect 
  GIT_REPOSITORY https://github.com/LTLA/CppMnnCorrect
  GIT_TAG 5ba5c790f01b3a676420892151791786dfb0a8d6
)
FetchContent_MakeAvailable(mnncorrect)

FetchContent_Declare(
  qdtsne 
  GIT_REPOSITORY https://github.com/LTLA/qdtsne
  GIT_TAG 72c81a00eda97cae2011abe06acce4525ecdd82a
)
FetchContent_MakeAvailable(qdtsne)

FetchContent_Declare(
  singlepp
  GIT_REPOSITORY https://github.com/LTLA/singlepp
  GIT_TAG 1d9869c3f050521a12b3151c89bc41906bf093e0
)
FetchContent_MakeAvailable(singlepp)

FetchContent_Declare(
  rds2cpp 
  GIT_REPOSITORY https://github.com/LTLA/rds2cpp
  GIT_TAG 58755b4bce01734f33fba12494f68c5aa6604a69
)
FetchContent_MakeAvailable(rds2cpp)


