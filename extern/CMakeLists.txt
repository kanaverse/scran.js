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

FetchContent_Declare(
  tatami 
  GIT_REPOSITORY https://github.com/tatami-inc/tatami
  GIT_TAG d6cb42539e434efce7fd24cd5abcbb1c006f74f3
)

FetchContent_Declare(
  tatami_layered
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_layered
  GIT_TAG e550a305ab17461970b78bf97579cc8308b03fd5
)

FetchContent_Declare(
  tatami_mtx
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_mtx
  GIT_TAG bc8f647dae4ada6480ee8c785fc4663d5bbf57ca
)

FetchContent_Declare(
  tatami_hdf5
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_hdf5
  GIT_TAG 20ec1fb64e0419907d3094827b5d9134854a0119
)

FetchContent_Declare(
  irlba
  GIT_REPOSITORY https://github.com/LTLA/CppIrlba
  GIT_TAG 15d6399fc2c9c2ed4755fa0baef373c086fdedd1
)

FetchContent_Declare(
  umappp 
  GIT_REPOSITORY https://github.com/LTLA/umappp
  GIT_TAG f2928b3018e9dc374fbe4553769f899e575e2f14 
)

FetchContent_Declare(
  scran 
  GIT_REPOSITORY https://github.com/LTLA/libscran
  GIT_TAG 8659e9c76bd7656b1d75051f26eb5aa08c935d9c
)

FetchContent_Declare(
  kmeans 
  GIT_REPOSITORY https://github.com/LTLA/CppKmeans
  GIT_TAG 4c5aca44bffd8ed7d7243b2451105b572028e9d4
)

FetchContent_Declare(
  mnncorrect 
  GIT_REPOSITORY https://github.com/LTLA/CppMnnCorrect
  GIT_TAG 5ba5c790f01b3a676420892151791786dfb0a8d6
)

FetchContent_Declare(
  qdtsne 
  GIT_REPOSITORY https://github.com/LTLA/qdtsne
  GIT_TAG 72c81a00eda97cae2011abe06acce4525ecdd82a
)

FetchContent_Declare(
  singlepp
  GIT_REPOSITORY https://github.com/LTLA/singlepp
  GIT_TAG 1d9869c3f050521a12b3151c89bc41906bf093e0
)

FetchContent_Declare(
  rds2cpp 
  GIT_REPOSITORY https://github.com/LTLA/rds2cpp
  GIT_TAG 58755b4bce01734f33fba12494f68c5aa6604a69
)

FetchContent_MakeAvailable(tatami)
FetchContent_MakeAvailable(tatami_layered)
FetchContent_MakeAvailable(tatami_mtx)
FetchContent_MakeAvailable(tatami_hdf5)
FetchContent_MakeAvailable(irlba)
FetchContent_MakeAvailable(umappp)
FetchContent_MakeAvailable(scran)
FetchContent_MakeAvailable(kmeans)
FetchContent_MakeAvailable(mnncorrect)
FetchContent_MakeAvailable(qdtsne)
FetchContent_MakeAvailable(singlepp)
FetchContent_MakeAvailable(rds2cpp)
