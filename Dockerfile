FROM ubuntu:latest

RUN apt-get update && \
    apt-get install -y git wget make python3

# Grabbing Emscripten. 
RUN git clone https://github.com/emscripten-core/emsdk.git && \
    cd emsdk && \
    ./emsdk install latest && \
    ./emsdk activate latest

# Grabbing CMake.
RUN wget https://github.com/Kitware/CMake/releases/download/v3.22.2/cmake-3.22.2-linux-x86_64.sh -O cmake_install.sh && \
    mkdir cmake && \
    bash cmake_install.sh --prefix=cmake --skip-license && \
    rm cmake_install.sh

ENV PATH="/emsdk:/emsdk/node/14.18.2_64bit/bin:/emsdk/upstream/emscripten:/cmake/bin:${PATH}"

RUN git clone https://github.com/jkanche/scran.js

WORKDIR scran.js

# Grabbing the node modules (happily enough, npm is installed along with emscripten).
RUN npm i --include=dev

# Revert any NPM-induced changes to these files.
RUN git checkout -- package.json

# Running the builds.
RUN ./build.sh main
RUN ./build.sh module
