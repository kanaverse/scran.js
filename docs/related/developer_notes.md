# Developer notes

## Overview 

We use WebAssembly (Wasm) to enable efficient client-side execution of common steps in a scRNA-seq analysis.
Code to perform each step is written in C++ and compiled to Wasm using the [Emscripten toolchain](https://emscripten.org/).
Some of the relevant C++ libraries are listed below:

- [libscran](https://github.com/libscran) provides C++ implementations of key functions in **scran** and its fellow packages **scater** and **scuttle**.
This includes quality control, normalization, feature selection, PCA, clustering and dimensionality reduction.
- [tatami](https://github.com/tatami-inc/tatami) provides an abstract interface to different matrix classes, focusing on row and column extraction.
- [knncolle](https://github.com/knncolle-inc/knncolle) wraps a number of nearest neighbor detection methods in a consistent interface.
- [CppIrlba](https://github.com/LTLA/CppIrlba) contains a C++ port of the IRLBA algorithm for approximate PCA.
- [CppKmeans](https://github.com/LTLA/CppKmeans) contains C++ ports of the Hartigan-Wong and Lloyd algorithms for k-means clustering.
- [qdtsne](https://github.com/libscran/qdtsne) contains a refactored C++ implementation of the Barnes-Hut t-SNE dimensionality reduction algorithm.
- [umappp](https://github.com/libscran/umappp) contains a refactored C++ implementation of the UMAP dimensionality reduction algorithm.

For each step, we use Emscripten to compile the associated C++ functions into Wasm and generate Javascript-visible bindings.
We can then load the Wasm binary into a web application and call the desired functions on user-supplied data.

## Pre-requisites

Install the most recent versions of the following tools.

- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html).
- [CMake](https://cmake.org/download/). 
  Avoid 4.2.0 though, see https://gitlab.kitware.com/cmake/cmake/-/issues/27421.
- [Node.js](https://nodejs.org/en/download).
  This requires 24.0.0 or higher to support Wasm64.

Alternatively, developers can use the [Docker image](https://github.com/kanaverse/emcmake-docker) for building and test.
This image is also used by our [GitHub actions](../../.github/workflows/run-tests.yaml), so it will probably work.

## Build

Running the `build.sh` script will generate browser or Node.js-compatible builds.

```sh
# For Node.js:
./build.sh main

# For the browser:
./build.sh browser 
```

These calls will create the `main` and `browser` directories respectively.
Each directory will contain its corresponding Wasm file in the `wasm` subdirectory.
All relevant Javascript files will also be copied into each subdirectory.

## Tests

```sh
npm install --include=dev
npm run test
```

To test the RDS reading functions, use a recent version of [R](https://cran.r-project.org/) to run [generate.R](../../tests/rds/generate.R) inside the `tests/rds` directory.

```sh
CHECK_RDS=1 npm run test -- tests/rds
```

## Documentation

```sh
npm run jsdoc
```

This creates an index file at `docs/built/index.html`.
