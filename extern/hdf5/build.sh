#!/bin/bash

HDF5_VERSION=1.14.5
HDF5_HASH=ec2e13c52e60f9a01491bb3158cb3778c985697131fc6a342262d32a26e58e44
SOURCE_DIR=hdf5-${HDF5_VERSION}

if [[ ! -e ${SOURCE_DIR} ]]
then
    wget https://github.com/HDFGroup/hdf5/releases/download/hdf5_${HDF5_VERSION}/hdf5-${HDF5_VERSION}.tar.gz -O hdf5.tar.gz
    OBSERVED_HASH=($(shasum -a 256 hdf5.tar.gz))
    if [[ ${OBSERVED_HASH} != ${HDF5_HASH} ]]
    then
        echo "hash mismatch for ${HDF5_VERSION} (got ${OBSERVED_HASH})"
        exit 1
    fi
    tar -xvf hdf5.tar.gz

    # Some source-editing shenanigans are required to deal with the lack of
    # FE_INVALID in Emscripten, see emscripten-core/emscripten#22005. Hey,
    # I don't make the rules.
    offender=${SOURCE_DIR}/src/H5Tinit_float.c 
    cat ${offender} | sed "s/feclearexcept(FE_INVALID)/0/" > tmp
    mv tmp ${offender}
fi

BUILD_DIR=build-${HDF5_VERSION}
if [ ! -e ${BUILD_DIR} ]
then
    mkdir -p ../installed
    coreflags="-pthread" # propagating compile flags from the root scran.js CMakeLists.txt.
    echo "{}" > package.json # avoid assuming ES6 module syntax from the root scran.js package.json.
    emcmake cmake \
        -S ${SOURCE_DIR} \
        -B ${BUILD_DIR} \
        -DCMAKE_C_FLAGS="${coreflags}" \
        -DCMAKE_CXX_FLAGS="${coreflags}" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=$(pwd)/../installed \
        -DBUILD_SHARED_LIBS=OFF \
        -DBUILD_TESTING=OFF \
        -DHDF5_BUILD_EXAMPLES=OFF \
        -DHDF5_BUILD_TOOLS=OFF \
        -DHDF5_BUILD_UTILS=OFF \
        -DHDF5_BUILD_CPP_LIB=ON \
        -DHDF5_ENABLE_Z_LIB_SUPPORT=ON \
        -DZLIB_USE_EXTERNAL=OFF \
        -DHDF5_ENABLE_SZIP_SUPPORT=OFF
fi

cd ${BUILD_DIR}
emmake make
emmake make install
