FROM ubuntu:latest

RUN apt-get update && \
    apt-get install -y git wget make python3

# Grabbing Emscripten. 
RUN git clone https://github.com/emscripten-core/emsdk.git && \
    cd emsdk && \
    ./emsdk install latest && \
    ./emsdk activate latest

# Grabbing CMake.
RUN wget https://github.com/Kitware/CMake/releases/download/v3.21.1/cmake-3.21.1-linux-x86_64.sh -O cmake_install.sh && \
    mkdir cmake && \
    bash cmake_install.sh --prefix=cmake --skip-license && \
    rm cmake_install.sh

ENV PATH="/emsdk:/emsdk/node/14.18.2_64bit/bin:/emsdk/upstream/emscripten:/cmake/bin:${PATH}"

RUN git clone https://github.com/jkanche/scran.js && \
    git checkout es6-npm-ghaction

WORKDIR scran.js

# Grabbing the node modules (happily enough, npm is installed along with emscripten).
RUN npm i --include=dev

# Running the builds.
RUN ./build.sh main
RUN ./build.sh module
