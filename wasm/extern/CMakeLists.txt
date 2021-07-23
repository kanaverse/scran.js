cmake_minimum_required(VERSION 3.14 FATAL_ERROR)

execute_process(COMMAND bash generate.sh
                WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/igraph)
set(F2C_EXTERNAL_ARITH_HEADER "${CMAKE_CURRENT_SOURCE_DIR}/igraph/arith.h")

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
