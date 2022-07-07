# Annotating cell types

## Overview

We use the same algorithm as **SingleR** for cell type classification from reference datasets.
This assumes that we have several files describing each reference dataset:

1. A matrix of ranks as a Gzipped CSV file.
2. Markers from pairwise comparisons as a Gzipped GMT file.
3. Labels for each reference sample as a Gzipped CSV file.
4. Feature names for the matrix as a Gzipped CSV file.
5. Names for all labels as a Gzipped CSV file.

Several datasets have been processed and made available [here](https://github.com/clusterfork/singlepp-references).

## Basic usage

Assuming the files have been downloaded and are available as `ArrayBuffer`s, we load the reference:

```js
let loaded = scran.loadLabelledReferenceFromBuffers(rankbuf, markbuf, labbuf); // files 1, 2 and 3, respectively.
```

We then build the reference given `testfeatures`, an array with the names of the features in our test dataset;
and `reffeatures`, an array with the names of the features in our reference (extracted from file **4**).

```js
let built = scran.buildLabelledReference(testfeatures, loaded, reffeatures);
```

Finally, we can generate labels from our input matrix.
This returns indices that can be cross-referenced to the actual names of the labels in file **5**.

```js
let labels = scran.labelCells(mat, built);
```

For interactive use, we may prefer to generate per-cluster labels rather than per-cell labels, as the former is much faster.
This is easily done by computing the cluster means, storing them in a dense column-major array and passing that array to `labelCells`.

## Integrated analyses

Advanced users can integrate cell labels from multiple references with the `integrateCellLabels` function.
Firstly, we classify our test dataset against each of the references individually:

```js
let loaded_A = scran.loadLabelledReferenceFromBuffers(rankbuf_A, markbuf_A, labbuf_A); 
let built_A = scran.buildLabelledReference(testfeatures, loaded_A, reffeatures_A);
let labels_A = scran.labelCells(mat, built_A);

let loaded_B = scran.loadLabelledReferenceFromBuffers(rankbuf_B, markbuf_B, labbuf_B); 
let built_B = scran.buildLabelledReference(testfeatures, loaded_B, reffeatures_B);
let labels_B = scran.labelCells(mat, built_B);
```

We then integrate the references and the associated labels to obtain a single set of cell type calls across all references.
More specifically, this chooses the best reference for each cell, based on each reference's best cell type call for that cell. 

```js
let interbuilt = scran.integrateLabelledReferences(testfeatures, 
    [loaded_A, loaded_B], 
    [reffeatures_A, reffeatures_B], 
    [built_A, built_B]
);

let interlabels = scran.integrateCellLabels(mat, [labels_A, labels_B], inter);
```
