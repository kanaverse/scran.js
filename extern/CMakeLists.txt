cmake_minimum_required(VERSION 3.14 FATAL_ERROR)

include(FetchContent)

FetchContent_Declare(
  aarand
  GIT_REPOSITORY https://github.com/LTLA/aarand
  GIT_TAG v1.1.0
)

FetchContent_Declare(
  subpar
  GIT_REPOSITORY https://github.com/LTLA/subpar
  GIT_TAG v0.4.1
)

FetchContent_Declare(
  sanisizer 
  GIT_REPOSITORY https://github.com/LTLA/sanisizer
  GIT_TAG v0.1.4
)

FetchContent_Declare(
  tatami 
  GIT_REPOSITORY https://github.com/tatami-inc/tatami
  GIT_TAG v4.0.3
)

FetchContent_Declare(
  tatami_stats
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_stats
  GIT_TAG v2.0.1
)

FetchContent_Declare(
  tatami_mult
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_mult
  GIT_TAG v0.1.3
)

FetchContent_Declare(
  tatami_chunked
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_chunked
  GIT_TAG v2.1.0
)

FetchContent_Declare(
  eminem
  GIT_REPOSITORY https://github.com/tatami-inc/eminem
  GIT_TAG v1.2.0
)

FetchContent_Declare(
  tatami_mtx
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_mtx
  GIT_TAG v2.1.0
)

FetchContent_Declare(
  tatami_hdf5
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_hdf5
  GIT_TAG v2.0.5
)

FetchContent_Declare(
  tatami_layered
  GIT_REPOSITORY https://github.com/tatami-inc/tatami_layered
  GIT_TAG v2.1.0
)

FetchContent_Declare(
  eigen
  GIT_REPOSITORY https://gitlab.com/libeigen/eigen
  GIT_TAG 5.0.0
)

FetchContent_Declare(
  irlba
  GIT_REPOSITORY https://github.com/LTLA/CppIrlba
  GIT_TAG v3.0.0
)

FetchContent_Declare(
  kmeans 
  GIT_REPOSITORY https://github.com/LTLA/CppKmeans
  GIT_TAG v4.0.4
)

FetchContent_Declare(
  annoy
  GIT_REPOSITORY https://github.com/spotify/annoy
  GIT_TAG v1.17.2
)

FetchContent_Declare(
  knncolle
  GIT_REPOSITORY https://github.com/knncolle/knncolle
  GIT_TAG v3.0.0
)

FetchContent_Declare(
  knncolle_annoy
  GIT_REPOSITORY https://github.com/knncolle/knncolle_annoy
  GIT_TAG v0.2.0
)

FetchContent_Declare(
  scran_qc
  GIT_REPOSITORY https://github.com/libscran/scran_qc
  GIT_TAG v0.2.0
)

FetchContent_Declare(
  scran_norm
  GIT_REPOSITORY https://github.com/libscran/scran_norm
  GIT_TAG v0.2.0
)

FetchContent_Declare(
  scran_blocks
  GIT_REPOSITORY https://github.com/libscran/scran_blocks
  GIT_TAG v0.1.1
)

FetchContent_Declare(
  WeightedLowess 
  GIT_REPOSITORY https://github.com/LTLA/CppWeightedLowess
  GIT_TAG v2.1.4
)

FetchContent_Declare(
  topicks
  GIT_REPOSITORY https://github.com/libscran/topicks
  GIT_TAG v0.2.2
)

FetchContent_Declare(
  scran_variances
  GIT_REPOSITORY https://github.com/libscran/scran_variances
  GIT_TAG v0.2.1
)

FetchContent_Declare(
  scran_pca
  GIT_REPOSITORY https://github.com/libscran/scran_pca
  GIT_TAG v0.3.0
)

FetchContent_Declare(
  mumosa
  GIT_REPOSITORY https://github.com/libscran/mumosa
  GIT_TAG v0.2.1
)

FetchContent_Declare(
  raiigraph
  GIT_REPOSITORY https://github.com/LTLA/raiigraph
  GIT_TAG v1.2.0
)

FetchContent_Declare(
  scran_graph_cluster
  GIT_REPOSITORY https://github.com/libscran/scran_graph_cluster
  GIT_TAG v0.3.0
)

FetchContent_Declare(
  scran_markers
  GIT_REPOSITORY https://github.com/libscran/scran_markers
  GIT_TAG v0.3.0
)

FetchContent_Declare(
  scran_aggregate
  GIT_REPOSITORY https://github.com/libscran/scran_aggregate
  GIT_TAG v0.2.0
)

FetchContent_Declare(
  phyper 
  GIT_REPOSITORY https://github.com/libscran/phyper
  GIT_TAG v0.1.1
)

FetchContent_Declare(
  gsdecon
  GIT_REPOSITORY https://github.com/libscran/gsdecon
  GIT_TAG v0.2.0
)

FetchContent_Declare(
  qdtsne 
  GIT_REPOSITORY https://github.com/libscran/qdtsne
  GIT_TAG v3.0.1
)

FetchContent_Declare(
  umappp 
  GIT_REPOSITORY https://github.com/libscran/umappp
  GIT_TAG v3.2.0
)

FetchContent_Declare(
  mnncorrect 
  GIT_REPOSITORY https://github.com/libscran/mnncorrect
  GIT_TAG v3.0.1
)

FetchContent_Declare(
  byteme
  GIT_REPOSITORY https://github.com/LTLA/byteme
  GIT_TAG v2.0.1
)

FetchContent_Declare(
  singlepp_loaders
  GIT_REPOSITORY https://github.com/SingleR-inc/singlepp_loaders
  GIT_TAG v0.2.0
)

FetchContent_Declare(
  singlepp
  GIT_REPOSITORY https://github.com/SingleR-inc/singlepp
  GIT_TAG v3.0.1
)

FetchContent_Declare(
  rds2cpp 
  GIT_REPOSITORY https://github.com/LTLA/rds2cpp
  GIT_TAG v1.2.0
)

# Forcing the Eigen build to create the installation files,
# otherwise irlba's own installation gets confused.
option(EIGEN_BUILD_CMAKE_PACKAGE "Build the Eigen Cmake package" ON)

FetchContent_MakeAvailable(aarand)
FetchContent_MakeAvailable(subpar)
FetchContent_MakeAvailable(sanisizer)

FetchContent_MakeAvailable(tatami)
FetchContent_MakeAvailable(tatami_stats)
FetchContent_MakeAvailable(tatami_mult)

FetchContent_MakeAvailable(tatami_chunked)
FetchContent_MakeAvailable(tatami_hdf5)

FetchContent_MakeAvailable(eminem)
FetchContent_MakeAvailable(tatami_mtx)
FetchContent_MakeAvailable(tatami_layered)

FetchContent_MakeAvailable(kmeans)

FetchContent_MakeAvailable(knncolle)
FetchContent_MakeAvailable(annoy)
FetchContent_MakeAvailable(knncolle_annoy)

FetchContent_MakeAvailable(scran_blocks)
FetchContent_MakeAvailable(scran_qc)
FetchContent_MakeAvailable(scran_norm)

FetchContent_MakeAvailable(WeightedLowess)
FetchContent_MakeAvailable(topicks)
FetchContent_MakeAvailable(scran_variances)

FetchContent_MakeAvailable(eigen)
FetchContent_MakeAvailable(irlba)
FetchContent_MakeAvailable(scran_pca)

FetchContent_MakeAvailable(raiigraph)
FetchContent_MakeAvailable(scran_graph_cluster)

FetchContent_MakeAvailable(scran_markers)

FetchContent_MakeAvailable(scran_aggregate)

FetchContent_MakeAvailable(gsdecon)

FetchContent_MakeAvailable(mumosa)

FetchContent_MakeAvailable(phyper)

FetchContent_MakeAvailable(umappp)

FetchContent_MakeAvailable(qdtsne)

FetchContent_MakeAvailable(mnncorrect)

FetchContent_MakeAvailable(byteme)
FetchContent_MakeAvailable(singlepp)
FetchContent_MakeAvailable(singlepp_loaders)

FetchContent_MakeAvailable(rds2cpp)

if (NOT EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/include)
    file(MAKE_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/include)
endif()
if (NOT EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/include/clrm1.hpp)
    file(DOWNLOAD https://raw.githubusercontent.com/libscran/clrm1/refs/tags/v0.2.0/package/src/clrm1.hpp ${CMAKE_CURRENT_SOURCE_DIR}/include/clrm1.hpp)
endif()
