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

# TODO: update the dependency in libscran.
FetchContent_Declare(
  tatami 
  GIT_REPOSITORY https://github.com/LTLA/tatami
  GIT_TAG 2dc49a3cc71907eb276de6fecb70fe6f6e01a59a
)
FetchContent_MakeAvailable(tatami)

# TODO: update the dependency in libscran, knncolle.
FetchContent_Declare(
  kmeans 
  GIT_REPOSITORY https://github.com/LTLA/CppKmeans
  GIT_TAG 5c5dd42d1293f0c684c3b241be3001a143ad351b
)
FetchContent_MakeAvailable(kmeans)

FetchContent_Declare(
  scran 
  GIT_REPOSITORY https://github.com/LTLA/libscran
  GIT_TAG 4f3aaaef278918ff1d83c585d80b92b53bbb28d1
)
FetchContent_MakeAvailable(scran)

FetchContent_Declare(
  qdtsne 
  GIT_REPOSITORY https://github.com/LTLA/qdtsne
  GIT_TAG e189c57980b36a6f337af8e562804f97963bb26f
)
FetchContent_MakeAvailable(qdtsne)

FetchContent_Declare(
  umappp 
  GIT_REPOSITORY https://github.com/LTLA/umappp
  GIT_TAG 46e169b8df80725abca76e8007840ec17c54c819
)
FetchContent_MakeAvailable(umappp)

FetchContent_Declare(
  h5wasm
  GIT_REPOSITORY https://github.com/LTLA/h5wasm-cmake-demo
  GIT_TAG master
)
FetchContent_MakeAvailable(h5wasm)

FetchContent_Declare(
  singlepp
  GIT_REPOSITORY https://github.com/LTLA/singlepp
  GIT_TAG 01a21a060f6d1d0427cd1ce034ef2a709d6ce9e7
)
FetchContent_MakeAvailable(singlepp)
