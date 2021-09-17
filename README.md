# Single cell RNA-seq analysis in Javascript

## Overview

This repository contains **scran.js**, a Javascript library and web application for single-cell RNA-seq (scRNA-seq) analysis in the browser.
Unlike other scRNA-seq web applications (e.g., based on Shiny), we do not need access to a server to perform the calculations.
Rather, the calculations are performed directly by the client, allowing us to take advantage of the ubiquity of the browser as a standalone analysis platform.
Users can then directly analyze their data without needing to manage any dependencies or pay for access to a backend.

**scran.js** is heavily inspired by the [**scran** R package](https://bioconductor.org/packages/scran) and contains most of its related methods.
Indeed, much of the implementation in this repository is taken directly from **scran** and its related R packages.

## Support for key scRNA-seq analysis steps

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

## Build wasm

```
# inside wasm

cmake .
make
```

## development

```
cd src
php -S localhost:7777
# then go to browser http://localhost:7777/app/index.html
```

## Building and running on localhost
# parcel currently has issues with wasm. waiting for wasm2 to come out
First install dependencies:

```sh
npm install
```

To run in hot module reloading mode:

```sh
npm start
```

To create a production build:

```sh
npm run build-prod
```

## Running

```sh
node dist/bundle.js
```

TODO:
- [ ] Need loading screens when waiting for worker to process
    - [ ] progress at each steps 
- [ ] Allow users to upload identities
    either by regular expression
    human - MT-
    mouse - mt-
- [ ] next button on every step
- [ ] better css layouts
    - steps on the top
    - left - description
    - center - content
    - right - optional ui input/settings
- [ ] QC: 
    - [ ] log y-axis on qc plots
    - [ ] 
- [ ] PCA: 
    - [ ] show % 
    - [ ] allow users to choose # of pcs
- [ ] 
