FROM ghcr.io/ltla/emcmake-docker/builder:2023-07-17
ENV PATH="/emsdk/node/16.20.0_64bit/bin:${FINALPATH}"

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
