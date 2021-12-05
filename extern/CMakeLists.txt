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
    execute_process(COMMAND node arithchk.js OUTPUT_FILE arith.h WORKING_DIRECTORY ${ARITH_DIR})
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
  scran 
  GIT_REPOSITORY https://github.com/LTLA/libscran
  GIT_TAG master
)
FetchContent_MakeAvailable(scran)

FetchContent_Declare(
  irlba 
  GIT_REPOSITORY https://github.com/LTLA/CppIrlba
  GIT_TAG master
)
FetchContent_MakeAvailable(irlba)

FetchContent_Declare(
  qdtsne 
  GIT_REPOSITORY https://github.com/LTLA/qdtsne
  GIT_TAG master
)
FetchContent_MakeAvailable(qdtsne)

FetchContent_Declare(
  umappp 
  GIT_REPOSITORY https://github.com/LTLA/umappp
  GIT_TAG master
)
FetchContent_MakeAvailable(umappp)
