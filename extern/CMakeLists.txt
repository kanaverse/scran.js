cmake_minimum_required(VERSION 3.14 FATAL_ERROR)

# Building the arith.h file for igraph (required from libscran).
set(ARITH_DIR "${CMAKE_CURRENT_BINARY_DIR}/igraph")
set(ARITH_H_PATH "${ARITH_DIR}/arith.h")
if(NOT EXISTS ${ARITH_H_PATH})
    file(MAKE_DIRECTORY ${ARITH_DIR})
    if(NOT EXISTS "${ARITH_DIR}/arithchk.c")
        file(DOWNLOAD https://raw.githubusercontent.com/igraph/igraph/298c0ac9777869090de2b3bca94a4d17cd5564fa/vendor/f2c/arithchk.c "${ARITH_DIR}/arithchk.c")
    endif()
    execute_process(COMMAND ${CMAKE_C_COMPILER} arithchk.c -lm -DNO_FPINIT -o arithchk.js WORKING_DIRECTORY ${ARITH_DIR})
    execute_process(COMMAND touch package.json WORKING_DIRECTORY ${ARITH_DIR}) # override the top-level package.json, which causes module-related problems.
    execute_process(COMMAND node arithchk.js OUTPUT_FILE arith.h WORKING_DIRECTORY ${ARITH_DIR})
    execute_process(COMMAND rm package.json WORKING_DIRECTORY ${ARITH_DIR}) # mopping up
endif()
set(F2C_EXTERNAL_ARITH_HEADER ${ARITH_H_PATH} CACHE FILEPATH "" FORCE)
set(IGRAPH_WARNINGS_AS_ERRORS OFF CACHE BOOL "" FORCE)

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

# Fetching all the other content.
include(FetchContent)

FetchContent_Declare(
  kmeans 
  GIT_REPOSITORY https://github.com/LTLA/CppKmeans
  GIT_TAG 698cd1279530675e8ea10bf58d3a1d1508fa1fb8
)
FetchContent_MakeAvailable(kmeans)

FetchContent_Declare(
  scran 
  GIT_REPOSITORY https://github.com/LTLA/libscran
  GIT_TAG aca4da597769bc39e56e73061a5c92382de253c1
)
FetchContent_MakeAvailable(scran)

FetchContent_Declare(
  mnncorrect 
  GIT_REPOSITORY https://github.com/LTLA/CppMnnCorrect
  GIT_TAG c7ed2431408a56e3e3d4d9688e2f961d8abc0c9c
)
FetchContent_MakeAvailable(mnncorrect)

FetchContent_Declare(
  qdtsne 
  GIT_REPOSITORY https://github.com/LTLA/qdtsne
  GIT_TAG 72c81a00eda97cae2011abe06acce4525ecdd82a
)
FetchContent_MakeAvailable(qdtsne)

FetchContent_Declare(
  umappp 
  GIT_REPOSITORY https://github.com/LTLA/umappp
  GIT_TAG b65785b631c73e34008253f6dc2c04a19c8c6795
)
FetchContent_MakeAvailable(umappp)

FetchContent_Declare(
  h5wasm
  URL https://github.com/usnistgov/libhdf5-wasm/releases/download/v0.1.1/libhdf5-1_12_1-wasm.tar.gz
  URL_HASH SHA256=e9bb11d89c4f26fa79b9cf1dab6159640c7b184ebf00dc97b098cd4f6de49bfe
)
FetchContent_MakeAvailable(h5wasm)

FetchContent_Declare(
  singlepp
  GIT_REPOSITORY https://github.com/LTLA/singlepp
  GIT_TAG 3b0ac094f7398770018773243da990f4e9ebfbeb
)
FetchContent_MakeAvailable(singlepp)

FetchContent_Declare(
  rds2cpp 
  GIT_REPOSITORY https://github.com/LTLA/rds2cpp
  GIT_TAG e18490b6cf6646db91ff0b10d590374bdfb2a2dc
)
FetchContent_MakeAvailable(rds2cpp)

