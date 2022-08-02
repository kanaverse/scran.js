# Developer notes

## Overview 

We use WebAssembly (Wasm) to enable efficient client-side execution of common steps in a scRNA-seq analysis.
Code to perform each step is written in C++ and compiled to Wasm using the [Emscripten toolchain](https://emscripten.org/).
Some of the relevant C++ libraries are listed below:

- [libscran](https://github.com/LTLA/libscran) provides C++ implementations of key functions in **scran** and its fellow packages **scater** and **scuttle**.
This includes quality control, normalization, feature selection, PCA, clustering and dimensionality reduction.
- [tatami](https://github.com/LTLA/tatami) provides an abstract interface to different matrix classes, focusing on row and column extraction.
- [knncolle](https://github.com/LTLA/knncolle) wraps a number of nearest neighbor detection methods in a consistent interface.
- [CppIrlba](https://github.com/LTLA/CppIrlba) contains a C++ port of the IRLBA algorithm for approximate PCA.
- [CppKmeans](https://github.com/LTLA/CppKmeans) contains C++ ports of the Hartigan-Wong and Lloyd algorithms for k-means clustering.
- [qdtsne](https://github.com/LTLA/qdtsne) contains a refactored C++ implementation of the Barnes-Hut t-SNE dimensionality reduction algorithm.
- [umappp](https://github.com/LTLA/umappp) contains a refactored C++ implementation of the UMAP dimensionality reduction algorithm.

For each step, we use Emscripten to compile the associated C++ functions into Wasm and generate Javascript-visible bindings.
We can then load the Wasm binary into a web application and call the desired functions on user-supplied data.
Reference documentation for the Wasm bindings is available [here](https://jkanche.github.io/scran.js/wasm).

## Build procedure 

Make sure [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) and [CMake](https://cmake.org/download/) are installed on your machine.
Running the `build.sh` script will then generate ES6 and Node.js-compatible builds.
To build the Node.js version:

```sh
bash build.sh main
```

To build the browser-compatible version:

```sh
bash build.sh browser 
```

This will create the `main` and `browser` directories respectively,
containing the Wasm file in the `wasm` subdirectory as well as copying all the relevant Javascript bindings.

## Tests

Run the test suite by calling:

```
# install dev dependencies
npm install --include=dev
npm run test
```

For earlier versions of Node, you may instead need to do some combination of the following options:

```
node --experimental-vm-modules --experimental-wasm-threads --experimental-wasm-bulk-memory --experimental-wasm-bigint node_modules/jest/bin/jest.js
```
