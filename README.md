# Single cell RNA-seq analysis in Javascript

## Overview

This repository contains **scran.js**, a Javascript library for single-cell RNA-seq (scRNA-seq) analysis in the browser.
The various calculations are performed directly by the client, allowing us to take advantage of the ubiquity of the browser as a standalone analysis platform.
Users can then directly analyze their data without needing to manage any dependencies or pay for access to a backend.
**scran.js** is heavily inspired by the [**scran** R package](https://bioconductor.org/packages/scran) and contains most of its related methods.
Indeed, much of the implementation in this repository is taken directly from **scran** and its related R packages.

## Analysis overview

Currently, the library and web app supports the key steps in a typical scRNA-seq analysis:

- Quality control (QC) to remove low-quality cells.
This is done based on detection of outliers on QC metrics like the number of detected genes.
- Normalization and log-transformation, to remove biases and mitigate the mean-variance trend.
We use scaling normalization with size factors defined from the library size for each cell.
- Feature selection to identify highly variable genes.
This is based on residuals from a trend fitted to the means and variances of the log-normalized data for each gene.
- Principal components analysis (PCA) on the highly variable genes, to compress and denoise the data.
We use an approximate method to quickly obtain the top few PCs.
- Clustering on the cells using the top PCs.
This can either use k-means or multi-level community detection (a.k.a., "Louvain clustering") on a shared nearest neighbor graph.
- Dimensionality reduction with t-stochastic neighbor embedding (t-SNE), again using the top PCs.
- Marker detection using a variety of effect sizes such as Cohen's d and the area under the curve (AUC).

Coming soon:

- Clustering using k-means.
- Batch correction via the mutual nearest neighbors method.
- Cell type annotation with **SingleR**.

The theory behind these methods is described in more detail in the [**Orchestrating Single Cell Analysis with Bioconductor**](https://bioconductor.org/books/release/OSCA/) book. 

## Quick start

**scran.js** is available as an [npm package](https://www.npmjs.com/package/scran.js), so installation can be performed via the usual procedure:

```sh
npm install scran.js
```

Then you can import and initialize the library using the standard ES6 notation.
Before any actual analysis steps are performed, the `initialize()` function must be run and its promise resolved;
we suggest using a top-level `await` for convenience.

```js
import * as scran from "scran.js";
await scran.initialize({ numberOfThreads: 4 }); // for old Node versions, set localFile: true
```

After that, you can run the remaining steps synchronously.
Below is an example using the Node.js API with one of our example [Matrix Market files](https://github.com/jkanche/random-test-files).

```js
// Reading the file in.
import * as fs from "fs";
let buffer = fs.readFileSync("matrix.mtx.gz");
let mat = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);

// Performing the QC.
let qc_metrics = scran.computePerCellQCMetrics(mat, [ /* specify mito subset here */ ]);
let qc_thresholds = scran.computePerCellQCThresholds(qc_metrics);
let filtered = scran.filterCells(mat, qc_thresholds.discardOverall());

// Log-normalizing.
let normalized = scran.logNormCounts(filtered);

// Modelling per-gene variance and selecting top HVGs. 
let varmodel = scran.modelGeneVar(normalized);
let hvgs = scran.chooseHVGs(varmodel, { number: 4000 });

// Performing the PCA.
let pcs = scran.runPCA(normalized, { features: hvgs });

// Building the neighbor search index on the PCs.
let index = scran.buildNeighborSearchIndex(pcs);

// Performing the clustering. 
let cluster_graph = scran.buildSNNGraph(index, { neighbors: 10 });
let clustering  = scran.clusterSNNGraph(cluster_graph);

// Performing the t-SNE and UMAP.
let tsne_status = scran.initializeTSNE(index);
let tsne_res = scran.runTSNE(tsne_status);

let umap_status = scran.initializeUMAP(index);
let umap_res = scran.runUMAP(umap_status);
```

All custom classes returned by **scran.js** functions refer to allocations on the Wasm heap and are not subject to garbage collection by Javascript.
If you intend to perform more **scran.js** operations after your analysis is complete, you will need to manually free your existing objects to make space for new ones.
We suggest using the pattern below to catch all objects and free them.

```js
var things = {};
things.mat = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);

/** some work here, possibly adding more objects to 'things' **/

// Once the analysis is complete and results have been saved to file.
for (const [key, val] of Object.entries(things)) {
    val.free();
}
```

On Node.js, it is also necessary to terminate the workers after all analyses are complete.
This is achieved by calling `scran.terminate()` once all operations are finished.
Otherwise, the Node.js process will hang indefinitely as it waits for the workers to return.

Reference documentation for the Javascript API is available [here](https://jkanche.github.io/scran.js).

## Developer notes

### Introducing WebAssembly 

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

### Building the Wasm binary

Make sure [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) and [CMake](https://cmake.org/download/) are installed on your machine.
Running the `build.sh` script will then generate ES6 and Node.js-compatible builds.
To build the Node.js version:

```sh
bash build.sh main
```

To build the ES6 version:

```sh
bash build.sh module
```

This will create the `main` and `module` directories respectively,
containing the Wasm file in the `wasm` subdirectory as well as copying all the relevant Javascript bindings.

### Tests

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

## Links

Check out [kana](https://github.com/jkanche/kana) to see how **scran.js** is used in an interactive scRNA-seq analysis application.

The [**scran.chan**](https://github.com/LTLA/scran.chan) R package and [**scran**](https://github.com/LTLA/scran-cli) executable 
are based on the same C++ libraries and allow the same analysis to be performed in different environments.
