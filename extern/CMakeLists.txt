cmake_minimum_required(VERSION 3.14 FATAL_ERROR)

# Building the arith.h file for igraph (via libscran).
set(ARITH_DIR "${CMAKE_CURRENT_BINARY_DIR}/igraph_arith")
set(ARITH_H_PATH "${ARITH_DIR}/arith.h")
if(NOT EXISTS ${ARITH_H_PATH})
    if (NOT EXISTS ${ARITH_DIR})
        file(MAKE_DIRECTORY ${ARITH_DIR})
    endif()
    if(NOT EXISTS "${ARITH_DIR}/arithchk.c")
        file(DOWNLOAD https://raw.githubusercontent.com/igraph/igraph/298c0ac9777869090de2b3bca94a4d17cd5564fa/vendor/f2c/arithchk.c "${ARITH_DIR}/arithchk.c")
    endif()
    execute_process(COMMAND ${CMAKE_C_COMPILER} arithchk.c -lm -DNO_FPINIT -o arithchk.js WORKING_DIRECTORY ${ARITH_DIR})
    execute_process(COMMAND node arithchk.js OUTPUT_FILE arith.h WORKING_DIRECTORY ${ARITH_DIR})
endif()
set(F2C_EXTERNAL_ARITH_HEADER ${ARITH_H_PATH} CACHE FILEPATH "" FORCE)
set(IGRAPH_WARNINGS_AS_ERRORS OFF CACHE BOOL "" FORCE)

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
