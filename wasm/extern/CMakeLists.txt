cmake_minimum_required(VERSION 3.14 FATAL_ERROR)

include(FetchContent)

FetchContent_Declare(
  scran 
  GIT_REPOSITORY https://github.com/LTLA/libscran
  GIT_TAG matrixmarket
)
FetchContent_MakeAvailable(scran)

FetchContent_Declare(
  irlba 
  GIT_REPOSITORY https://github.com/LTLA/CppIrlba
  GIT_TAG master
)
FetchContent_MakeAvailable(irlba)

if (NOT HAVE_ZLIB_H)
    # Pulling zlib from the port repository, which should hopefully
    # be similar enough to whatever emcc is pulling down when USE_ZLIB=1.
    # We just need it for the headers so we won't bother building it,
    # given that they'll be linked to the right WASM file later on.
    FetchContent_Declare(
      zlib
      GIT_REPOSITORY https://github.com/emscripten-ports/zlib
      GIT_TAG master
      CONFIGURE_COMMAND ""
      BUILD_COMMAND ""
    )

    FetchContent_GetProperties(zlib)
    if(NOT zlib_POPULATED)
      FetchContent_Populate(zlib)
    endif()

    add_library(zlib INTERFACE)
    target_include_directories(zlib INTERFACE ${zlib_SOURCE_DIR})
endif()
