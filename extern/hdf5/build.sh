#!/bin/bash

set -e
set -u

HDF5_VERSION=2.0.0
HDF5_HASH=f4c2edc5668fb846627182708dbe1e16c60c467e63177a75b0b9f12c19d7efed
SOURCE_DIR=hdf5-${HDF5_VERSION}

if [[ ! -e ${SOURCE_DIR} ]]
then
    wget -q https://github.com/HDFGroup/hdf5/releases/download/${HDF5_VERSION}/hdf5-${HDF5_VERSION}.tar.gz -O hdf5.tar.gz
    OBSERVED_HASH=($(shasum -a 256 hdf5.tar.gz))
    if [[ ${OBSERVED_HASH} != ${HDF5_HASH} ]]
    then
        echo "hash mismatch for ${HDF5_VERSION} (got ${OBSERVED_HASH})"
        exit 1
    fi
    tar -xf hdf5.tar.gz
fi

BUILD_DIR=build-${HDF5_VERSION}
if [ ! -e ${BUILD_DIR} ]
then
    mkdir -p ../installed
    coreflags="-pthread -sMEMORY64" # propagating compile flags from the root scran.js CMakeLists.txt.
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
        -DHDF5_ENABLE_ZLIB_SUPPORT=ON \
        -DZLIB_USE_EXTERNAL=OFF \
        -DHDF5_ENABLE_SZIP_SUPPORT=OFF
fi

cd ${BUILD_DIR}
emmake make
emmake make install
