# scran.js news

## 0.2.1

**New**

- Exposed a reference policy option in `mnnCorrect()` for choosing the reference batch.
- Support more community detection methods in `clusterSNNGraph()`.

**Changes**

- Any attempt to save `null`s via the HDF5 writers will now raise an error.
- Any attempt to save non-strings as strings in the HDF5 writers will raise an error.

## 0.2.0

**New**

- Added `scaleByNeighbors()` for combining embeddings across multiple modalities.
- Added `computePerCellAdtQcMetrics()` and `computePerCellAdtQcFilters()` for quality control on the ADT count matrix.
- Added `quickAdtSizeFactors()` to support normalization of ADT counts.
- Added `splitRows()` to split a ScranMatrix along its rows.
- Added `subsetArrayCollection()`, `splitArrayCollection()` and `combineArrayCollections()` for working with collections of parallel arrays.
- Added `createBlock()`, `convertBlock()`, `filterBlock()` and `dropUnusedBlock()` for creating and manipulating the blocking factor.

**Changes**

- `runPCA()` will automatically adjust the number of requested PCs to be no greater than the number of available PCs.
- Added a `numberOfDims()` method to retrieve the number of dimensions from a NeighborIndex object.
- `computePerCellQcMetrics()` now accepts an array of Uint8WasmArrays in `subsets=` rather than a single concatenated array.

## 0.1.1

**Changes**

- Deprecated `ScranMatrix::isPermuted()` for `ScranMatrix::isReorganized()`.
- Deprecated `permuteVector()` for `matchVectorToRowIdentities()`.
- Deprecated `updatePermutation()` for `updateRowIdentities()`.
- Deprecated `permuteFeatures()` for `matchFeatureAnnotationToRowIdentities()`.

## 0.1.0

- Switched to `identities()` to keep track of the identities of the rows in the in-memory `ScranMatrix`.
This is an improvement over `permutation()` as the `identities()` can naturally accommodate subsetting.

## Pre-0.1.0

First series of releases.
Didn't keep track of all the changes here, so let's just treat these releases as prehistory.
Check out the commit history for more details.
