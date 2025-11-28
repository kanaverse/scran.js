#!/bin/bash

set -e
set -u

IGRAPH_VERSION=1.0.0
IGRAPH_HASH=91e23e080634393dec4dfb02c2ae53ac4e3837172bb9047d32e39380b16c0bb0
SOURCE_DIR=igraph-${IGRAPH_VERSION}

if [[ ! -e ${SOURCE_DIR} ]]
then
    wget -q https://github.com/igraph/igraph/releases/download/${IGRAPH_VERSION}/igraph-${IGRAPH_VERSION}.tar.gz -O igraph.tar.gz
    OBSERVED_HASH=($(shasum -a 256 igraph.tar.gz))
    if [[ ${OBSERVED_HASH} != ${IGRAPH_HASH} ]]
    then
        echo "hash mismatch for ${IGRAPH_VERSION} (got ${OBSERVED_HASH})"
        exit 1
    fi
    tar -xf igraph.tar.gz
fi

BUILD_DIR=build-${IGRAPH_VERSION}
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
        -DIGRAPH_WARNINGS_AS_ERRORS=OFF \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=$(pwd)/../installed
fi

cd ${BUILD_DIR}
emmake make
emmake make install
