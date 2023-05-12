FROM ubuntu:latest

RUN apt-get update && \
    apt-get install -y git wget make python3 xz-utils lbzip2

# Grabbing Emscripten. 
RUN git clone https://github.com/emscripten-core/emsdk.git && \
    cd emsdk && \
    ./emsdk install 3.1.8 && \
    ./emsdk activate 3.1.8 

# Grabbing CMake.
RUN wget https://github.com/Kitware/CMake/releases/download/v3.22.2/cmake-3.22.2-linux-x86_64.sh -O cmake_install.sh && \
    mkdir cmake && \
    bash cmake_install.sh --prefix=cmake --skip-license && \
    rm cmake_install.sh

ENV FINALPATH="/emsdk:/emsdk/upstream/emscripten:/cmake/bin:${PATH}"
ENV PATH="/emsdk/node/15.14.0_64bit/bin:${FINALPATH}"

RUN git clone https://github.com/kanaverse/scran.js

WORKDIR scran.js

# Grabbing the node modules 
RUN npm i --include=dev

# Revert any NPM-induced changes to these files.
RUN git checkout -- package.json

# Running the builds.
RUN ./build.sh main
RUN ./build.sh browser

# Removing Node from the path.
ENV PATH="${FINALPATH}"
