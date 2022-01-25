# Single cell RNA-seq analysis in Javascript

## Overview

This repository contains **scran.js**, a Javascript library for single-cell RNA-seq (scRNA-seq) analysis in the browser.
The various calculations are performed directly by the client, allowing us to take advantage of the ubiquity of the browser as a standalone analysis platform.
Users can then directly analyze their data without needing to manage any dependencies or pay for access to a backend.
**scran.js** is heavily inspired by the [**scran** R package](https://bioconductor.org/packages/scran) and contains most of its related methods.
Indeed, much of the implementation in this repository is taken directly from **scran** and its related R packages.

## Key scRNA-seq analysis steps

Currently, the library and web app supports the key steps in a typical scRNA-seq analysis:

- Quality control (QC) to remove low-quality cells.
This is done based on detection of outliers on QC metrics like the number of detected genes.
- Normalization and log-transformation, to remove biases and mitigate the mean-variance trend.
We use scaling normalization with size factors defined from the library size for each cell.
- Feature selection to identify highly variable genes.
This is based on residuals from a trend fitted to the means and variances of the log-normalized data for each gene.
- Principal components analysis (PCA) on the highly variable genes, to compress and denoise the data.
We use an approximate method to quickly obtain the top few PCs.
- Clustering using multi-level community detection (a.k.a., "Louvain clustering").
This is performed on the top PCs.
- Dimensionality reduction with t-stochastic neighbor embedding (t-SNE), again using the top PCs.
- Marker detection using a variety of effect sizes such as Cohen's d and the area under the curve (AUC).

Coming soon:

- Clustering using k-means.
- Dimensionality reduction by uniform map and approximate projection (UMAP).
- Batch correction via the mutual nearest neighbors method.

The theory behind these methods is described in more detail in the [**Orchestrating Single Cell Analysis with Bioconductor**](https://bioconductor.org/books/release/OSCA/) book. 

## Efficient analysis with WebAssembly 

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

## Installation

scran.js is available as an [npm package](https://www.npmjs.com/package/scran.js)

```
npm install scran.js
```

Checkout our [Kana Application](https://github.com/jkanche/kana) on how scran.js package is used
in an interactive scRNA-seq analysis application.

## Building the Wasm binary

This directory contains the files required to create the **scran.js** Wasm binary.
We use CMake to manage the compilation process as well as the dependencies, namely the [**scran** C++ library](https://github.com/LTLA/libscran).
Compilation of the Wasm binary is done using Emscripten:

```sh
emcmake cmake -S . -B build
(cd build && emmake make)
```

To build node compatible library, add option `-DCCOMPILE_NODE=1` to the command. (check dev notes below)

This will build the `.js` and `.wasm` file within the `build/` subdirectory.

## Developer notes

Make sure emscripten and cmake are installed on your machine, `build.sh` script generates ES6 and node compatible builds.

To build node version of the library,

```
bash build.sh main
```

To build ES6 version of the library,

```
bash build.sh module
```

### Tests

```
# install dev dependencies
npm install --include=dev
npm run test
```

If you are using node 16 or 14, add run tests using

```
node --experimental-vm-modules --experimental-wasm-threads node_modules/jest/bin/jest.js
```

***Note: This dev notes is tested with node v17.2.0***