#!/bin/bash

IGRAPH_VERSION=0.10.13
IGRAPH_HASH=c6dc44324f61f52c098bedb81f6a602365d39d692d5068ca4fc3734b2a15e64c
SOURCE_DIR=igraph-${IGRAPH_VERSION}

if [[ ! -e ${SOURCE_DIR} ]]
then
    wget https://github.com/igraph/igraph/releases/download/${IGRAPH_VERSION}/igraph-${IGRAPH_VERSION}.tar.gz -O igraph.tar.gz
    OBSERVED_HASH=($(shasum -a 256 igraph.tar.gz))
    if [[ ${OBSERVED_HASH} != ${IGRAPH_HASH} ]]
    then
        echo "hash mismatch for ${IGRAGH_VERESION} (got ${OBSERVED_HASH})"
        exit 1
    fi
    tar -xvf igraph.tar.gz
fi

BUILD_DIR=build-${IGRAPH_VERSION}
if [ ! -e ${BUILD_DIR} ]
then
    mkdir -p ../installed
    export CPPFLAGS="-pthread"
    echo "{}" > package.json
    emcmake cmake \
        -S ${SOURCE_DIR} \
        -B ${BUILD_DIR} \
        -DIGRAPH_WARNINGS_AS_ERRORS=OFF \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=$(pwd)/../installed
fi

cd ${BUILD_DIR}
emmake make
emmake make install
