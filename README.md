# Single cell RNA-seq analysis in Javascript

## Overview

This repository contains **scran.js**, a Javascript library for single-cell RNA-seq (scRNA-seq) analysis in the browser.
The various calculations are performed directly by the client, allowing us to take advantage of the ubiquity of the browser as a standalone analysis platform.
Users can then directly analyze their data without needing to manage any dependencies or pay for access to a backend.
**scran.js** is heavily inspired by the [**scran** R package](https://bioconductor.org/packages/scran) and contains most of its related methods.
Indeed, much of the implementation in this repository is taken directly from **scran** and its related R packages.

## Analysis overview

**scran.js** implements key steps in a typical scRNA-seq analysis:

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
- Cell type annotation with a port of the [**SingleR**](https://bioconductor.org/packages/SingleR) algorithm.
- Batch correction via the mutual nearest neighbors method.

The theory behind these methods is described in more detail in the [**Orchestrating Single Cell Analysis with Bioconductor**](https://bioconductor.org/books/release/OSCA/) book. 
All steps are implemented in C++ and compiled to WebAssembly for near-native performance - see the [developer notes](#developer-notes) for details.

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

After that, you can run the remaining steps synchronously - for example, using the Node.js API:

```js
// Reading in the count matrix.
import * as fs from "fs";
let buffer = fs.readFileSync("matrix.mtx.gz");
let mat = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);
```

Reference documentation for the Javascript API is available [here](https://jkanche.github.io/scran.js).

## Basic analyses

The code chunk below implements a basic analysis, starting from count matrix loading and terminating at the markers for each cluster.
This uses the Node.js API to read in one of our example [Matrix Market files](https://github.com/jkanche/random-test-files),
but the same approach can be used on the buffer created from a `File` input in the browser.

```js
// Reading in the count matrix.
import * as fs from "fs";
let buffer = fs.readFileSync("matrix.mtx.gz");
let mat = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);

// Performing QC.
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
let clustering = scran.clusterSNNGraph(cluster_graph);

// Performing the t-SNE and UMAP.
let tsne_status = scran.initializeTSNE(index);
let tsne_res = scran.runTSNE(tsne_status);

let umap_status = scran.initializeUMAP(index);
let umap_res = scran.runUMAP(umap_status);

// Detecting some markers.
let markers = scran.scoreMarkers(normalized, clustering.membership());
```

Note that the order of rows is permuted on input - see [below](#permuting-the-row-order) for details.

## Further details

### Permuting the row order 

Rows of the dataset are permuted by `initializeSparseMatrix*()` functions to achieve a memory-efficient layout in `mat`.
The permutation to restore the original row order can be obtained with:

```js
let perm1 = mat.permutation();
```

This can be used to permute the results of per-gene analyses like `modelGeneVar()` and `scoreMarkers()` to match the original row order.
Alternatively, we can use:

```js
let perm2 = mat.permutation({ restore: false });
```

if we want to permute something in the original order to match the row order of `mat`.

### Memory management

All custom classes returned by **scran.js** functions refer to allocations on the Wasm heap and are not subject to garbage collection by Javascript.
If you intend to perform more **scran.js** operations after your analysis is complete, you will need to manually free existing objects to make space for new ones.
We suggest using the pattern below to catch all objects and free them.

```js
var things = {};
things.mat = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);

try {
    /** some work here, possibly adding more objects to 'things' **/
} finally {
    // Once the analysis is complete and results have been saved to file.
    for (const [key, val] of Object.entries(things)) {
        val.free();
    }
}
```

### Terminating workers

On Node.js, it is necessary to terminate the workers after all analyses are complete.
This is achieved by calling `scran.terminate()` once all operations are finished.
Otherwise, the Node.js process will hang indefinitely as it waits for the workers to return.
Browsers do not have this problem as the session ends when a user closes the relevant tab. 

### k-means clustering

For a faster alternative to the graph-based clustering algorithms, we can try using the k-means options instead.
We perform k-means clustering on the PC matrix, so the output of `runPCA()` can be directly passed to the function.
We need to specify the number of clusters - in this case, 20.

```js
let clustering = scran.clusterKmeans(pcs, 20);
```

We use PCA partitioning as the default initialization approach, which is more-or-less deterministic.
However, advanced users can play around with other initialization methods and seeds:

```js
let clustpp = scran.clusterKmeans(pcs, 20, { initMethod: "kmeans++", initSeed: 42 });
```

### Cell type classification

We use the same algorithm as **SingleR** for cell type classification from reference datasets (available [here](https://github.com/clusterfork/singlepp-references)).
This assumes that we have several files describing each reference dataset:

1. A matrix of ranks as a Gzipped CSV file.
2. Markers from pairwise comparisons as a Gzipped GMT file.
3. Labels for each reference sample as a Gzipped CSV file.
4. Feature names for the matrix as a Gzipped CSV file.
5. Names for all labels as a Gzipped CSV file.

Assuming the files have been downloaded and are available as `ArrayBuffer`s, we load the reference:

```js
let loaded = scran.loadLabelledReferenceFromBuffers(rankbuf, markbuf, labbuf); // files 1, 2 and 3, respectively.
```

We then build the reference given `testfeatures`, an array with the names of the features in our test dataset;
and `reffeatures`, an array with the names of the features in our reference (extracted from file **4**).
Note that `testfeatures` needs to be permuted to match the row order in our permuted matrix.

```js
let built = scran.buildLabelledReference(testfeatures, loaded, reffeatures);
```

Finally, we can generate labels from our input matrix.
This returns indices that can be cross-referenced to the actual names of the labels in file **5**.

```js
let labels = scran.labelCells(mat, built);
```

For interactive use, we may prefer to generate per-cluster labels rather than per-cell labels, as the former is much faster.
This is easily done by computing the cluster means, storing them in a dense array and passing that array to `labelCells`.

Advanced users can integrate cell labels from multiple references with the `integrateCells` function.
See the [tests](https://github.com/jkanche/scran.js/blob/master/tests/labelCells.test.js) for some working examples.

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
