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
This can either use k-means or community detection on a shared nearest neighbor graph.
- Dimensionality reduction with t-stochastic neighbor embedding (t-SNE), again using the top PCs.
- Marker detection using a variety of effect sizes such as Cohen's d and the area under the curve (AUC).
- Cell type annotation with a port of the [**SingleR**](https://bioconductor.org/packages/SingleR) algorithm.
- Batch correction via the mutual nearest neighbors method.

The theory behind these methods is described in more detail in the [**Orchestrating Single Cell Analysis with Bioconductor**](https://bioconductor.org/books/release/OSCA/) book. 
All steps are implemented in C++ and compiled to WebAssembly for near-native performance - see the [developer notes](docs/related/developer_notes.md) for details.

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

## Basic analyses

The code chunk below implements a basic analysis, starting from count matrix loading and terminating at the markers for each cluster.
This uses the Node.js API to read in one of our example [Matrix Market files](https://github.com/jkanche/random-test-files),
but the same approach can be used on the buffer created from a `File` input in the browser.

```js
import * as scran from "scran.js";
await scran.initialize({ numberOfThreads: 4 });

// Reading in the count matrix.
import * as fs from "fs";
let buffer = fs.readFileSync("matrix.mtx.gz");
let input = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);
let mat = input.matrix;

// Performing QC.
let qc_metrics = scran.computePerCellQCMetrics(mat, [ /* specify mito subset here */ ]);
let qc_thresholds = scran.computePerCellQCFilters(qc_metrics);
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

scran.terminate();
```

## More documentation

Reference documentation for the Javascript API is available [here](https://jkanche.github.io/scran.js).

Specific topics are discussed in more detail below:

- [Terminate upon completion](docs/related/termination.md)
- [Manually free memory](docs/related/memory_management.md)
- [Use k-means clustering](docs/related/kmeans_clustering.md)
- [Annotate cell types against references](docs/related/cell_type_annotation.md)
- [Handling the permuted row order](docs/related/row_permutations.md)

Developer notes are also available [here](docs/related/developer_notes.md).

## Links

Check out [kana](https://github.com/jkanche/kana) to see how **scran.js** is used in an interactive scRNA-seq analysis application.

The [**scran.chan**](https://github.com/LTLA/scran.chan) R package and [**scran**](https://github.com/LTLA/scran-cli) executable 
are based on the same C++ libraries and allow the same analysis to be performed in different environments.
