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

# Fetching all the other content.
include(FetchContent)

FetchContent_Declare(
  tatami
  GIT_REPOSITORY https://github.com/LTLA/tatami
  GIT_TAG 573f1fb772db0580ff80f0318006af1555c0b24e
)
FetchContent_MakeAvailable(tatami)

FetchContent_Declare(
  kmeans 
  GIT_REPOSITORY https://github.com/LTLA/CppKmeans
  GIT_TAG 698cd1279530675e8ea10bf58d3a1d1508fa1fb8
)
FetchContent_MakeAvailable(kmeans)

FetchContent_Declare(
  scran 
  GIT_REPOSITORY https://github.com/LTLA/libscran
  GIT_TAG cbbe4ce1334bde348b52984742f072ac49aa352a
)
FetchContent_MakeAvailable(scran)

# After scran's implicit include of igraph. 
# TODO: replace with igraph-wasm.
target_compile_options(igraph PUBLIC -pthread) 
target_compile_options(bliss PUBLIC -pthread) 
target_compile_options(cliquer PUBLIC -pthread)
target_compile_options(cxsparse_vendored PUBLIC -pthread)
target_compile_options(pcg PUBLIC -pthread)
target_compile_options(prpack PUBLIC -pthread)
target_compile_options(f2c_vendored PUBLIC -pthread)
target_compile_options(glpk_vendored PUBLIC -pthread)
target_compile_options(blas_vendored PUBLIC -pthread)
target_compile_options(lapack_vendored PUBLIC -pthread)
target_compile_options(arpack_vendored PUBLIC -pthread)
target_compile_options(gmp_vendored PUBLIC -pthread)
target_compile_options(plfit_vendored PUBLIC -pthread)

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
  URL https://github.com/kanaverse/libhdf5-wasm/releases/download/v0.3.0_3.1.43/libhdf5-1_12_2-wasm.tar.gz
  URL_HASH SHA256=b2e58b102fe98326c77f1a160025c47a062c1a205818568680d5f5ed78df801c
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

