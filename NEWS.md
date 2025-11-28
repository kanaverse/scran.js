# scran.js news

## 4.1.0

- Switch to 64-bit Wasm builds, which allows memory usage up to 16 GB.
  These only work with Node.js 24 or higher, and are currently not supported on Safari at all.
- Updated to the latest version of the **mnncorrect** library, which uses a new algorithm -
  see https://github.com/libscran/mnncorrect/releases/tag/v3.0.0 for details.
- Updated **igraph** to v1.0.0, which may yield different results for graph-based clustering.
- Updated **hdf5** to v2.0.0, to support files produced in the new formats.
- Updated to the latest version of the **tatami_hdf5** library,
  which improves performance for several types of non-contiguous reads from the HDF5 file.

## 4.0.9

- Updated the **phyper** library for more accurate p-value calculations in `hypergeometricTest()`.

## 4.0.8

- Bugfix to the `rotation()` method in `RunPcaResults`.
- Bugfix to exported methods in the browser build of the Wasm module.

## 4.0.7

- Soft-deprecated use of an array as input to `labelCells()`, `integrateLabelCells()`.
  Callers should construct and pass a `ScranMatrix` instead.
- Support custom names for component datasets in `initializeSparseMatrixFromHdf5Group()`.
- Soft-deprecated `initializeMatrixFromHdf5()` and `extractHdf5MatrixDetails()`.
  Callers should be more explicit about how the layout and shape is determined for each HDF5-based format.

## 4.0.6

- Added `transposeMatrix()` to quickly transpose a matrix stored in a contiguous TypedArray.

## 4.0.5

- Added `rowSums()` and `columnSums()` to compute the row and column sums, respectively, of a `ScranMatrix`.
- Added `chooseTopMarkers()` to get a array of the top markers from the `ScoreMarkersResults` statistics.

## 4.0.4

- Fixed a performance regression for `readRds()`.

## 4.0.3

- Bugfix to avoid a dangling memory view when retrieving statistics from a `ScoreMarkersResults` object.

## 4.0.2

- Added more options to `writeSparseMatrixToHdf5()`.
  - Setting `saveShape=false` will skip saving of the shape dataset/attribute.
  - Setting `overwrite=false` will add matrix contents to an existing HDF5 file.

## 4.0.1

- Bugfix to actually return sparse matrices from the various `initializeMatrixFromHdf5()` functions.

## 4.0.0

- Overhauled the HDF5 bindings:
  - HDF5 readers and writers can now handle compound data types.
  - Introduced the `H5StringType` and `H5EnumType` classes to better represent their associated HDF5 types.
  - `H5DataSet::type()` will now report `H5StringType` and `H5EnumType` instead of `"String"` and `"Enum"`. 
  - `readAttribute()` will now report the type of the attribute for `H5Group` and `H5DataSet` objects.
- Updated the ADT normalization code:
  - Added the `computeClrm1Factors()` function to implement the CLRm1 method.
  - Removed the `median/groupedSizeFactors()` functions.
- Renamed `logNormCounts()` to `normalizeCounts()` with a new `log=true` option.
- Renamed `testFeatureSetEnrichment()` to `testGeneSetEnrichment()`.
- Rotation matrices are now reported from `runPca()`.
- Block weighting is supported in `modelGeneVariances()`.
- Renamed `clusterSnnGraph()` to `clusterGraph()`.
- Added a `truncateNearestNeighbors()` utility to truncate the neighbor search results.
- Emit warnings if the requested and observed number of neighbors are different in functions that accept existing neighbor search results.
- Renamed `scoreFeatureSet()` to `scoreGsdecon()`.
- Updated the k-means clustering code in `clusterKmeans()`.
  - Replaced PCA-partitioning with variance partitioning for k-means initialization.
  - Exposed options for choosing the refinement algorithm and number of iterations.
- Updated the filtering during quality control.
  - All `Suggest*FilterResults::filter()` methods now return the cells to **keep**.
  - `filterCells()` now accepts a vector of cells to **keep**.
- Use single-precision floats in `runUmap()`, for speed and consistency with R.
- Renamed some methods to avoid unnecessary plurals, e.g., `sum()` instead of `sums()`.
- Added `isBlocked()` methods to `*Results` classes with methods that accept block IDs.
- Renamed all of the SingleR-related functions, for consistency with the underlying C++ library.
- Added an `asTypedArray=` option to various methods/functions to allow users to choose between returning a TypedArray or TypedWasmArray.
- Added a `columnMajor=` option for dense array initialization in `initializeDenseMatrixFromDenseArray()`, replacing `ScranMatrix::createDenseMatrix()`.
- Updated the matrix initialization from HDF5 datasets:
  - Renamed `initializeSparseMatrixFromHdf5()` to `initializeMatrixFromHdf5()`, with a new `forceSparse=` option to indicate whether the matrix should be sparse.
  - Renamed `initializeSparseMatrixFromHdf5DataSet()` to `initializeMatrixFromHdf5DataSet()`, with a new `forceSparse=` option to indicate whether the matrix should be sparse.

## 3.0.2

**New**

- Added the `initializeSparseMatrixFromHdf5DenseArray()` and `initializeSparseMatrixFromHdf5SparseMatrix()` functions,
  which exposes the internals used by the `initializeSparseMatrixFromHdf5()` function.
  These new functions give the user more control over the construction of sparse matrices from HDF5 files.

**Changes**

- Protected `cbindWithNames()` from weird names.
  Null names are ignored, allowing us to safely handle missing gene symbols.
  When names are duplicated, we explicitly keep only the first occurrence;
  this is more intuitive than the old (and undocumented) behavior of keeping only the last occurrence.
  The order of names from the first matrix is preserved in the final intersection, which should reduce the amount of reordering. 

## 3.0.1

**Changes**

- Updated to a more recent version of the underlying **tatami** library for some bugfixes and improvements.

## 3.0.0

**Changes**

- Setting `layered=true` in the various `initializeSparseMatrix*()` functions no longer reorders the rows, due to the use of the new [**tatami_layered**](https://github.com/tatami-inc/tatami_layered) library.
  As a result, all `initializeSparseMatrix*()` functions no longer need to return an array of `row_ids` and instead return the `ScranMatrix` directly where the rows are in the same order as defined in the file.
  This greatly simplifies downstream management of the row order.
- Renamed all functions to use PascalCase for acronyms, e.g., `HDF5` is now `Hdf5`, `PCA` is now `Pca`, `SNN` is now `Snn`.
  This gives us a consistent naming scheme across the package that aligns with the underlying C++ code.
- Renamed `modelGeneVar` to `modelGeneVariances` (similarly for its `*Results` class) for easier reading.
  - Also changed the weighting scheme so that we do not allow equal contributions from very small blocks (< 1000 cells) with less stable statistics.
    Large blocks will still be equally weighted, regardless of their actual size.
- Modified `scoreMarkers()` in response to **libscran** changes.
  - Added a weighting scheme identical to the one used by `modelGeneVariances()`.
    This now equalizes contributions from large blocks to each per-cluster statistics (> 1000 cells in the relevant cluster). 
  - Removed the `block=` option from the methods of the corresponding `Results` object, as averages are now automatically returned for the means and detected proportions. 
- Changed how blocking is handled in `runPca()`:
  - Added `blockMethod="project"` to enable projection of cells onto rotation vectors defined from residuals.
  - Added `blockWeights=` to determine whether to equalize the contribution of large blocks of different size, using the same scheme in `scoreMarkers()` and `modelGeneVariances()`.
    Equal weighting only applies once blocks reach a certain size (1000 cells), otherwise the weight of each block is proportional to its size.
  - Removed `blockMethod = "weight"`, which is replaced by `blockMethod = "none"` with `blockWeights = true`.
- Overhauled the interface for t-SNE and UMAP calculations:
  - Renamed the output of `initializeTsne()` and `initializeUmap()` to `TsneStatus` and `UmapStatus`, respectively.
  - Added a `run()` method to the status objects, which runs them for the specified time/number of iterations.
    This is more ergonomic than initializing the status objects and passing them to `runTsne()` or `runUmap()`.
  - Changed `runTsne()` and `runUmap()` to directly return the final t-SNE and UMAP coordinates, respectively, from the nearest neighbor input.
    This avoids exposing the status objects for basic use cases.
- Removed many of the `empty*Results()` functions, as these are not necessary for regular uses of this package.
  The exception is that of the `emptySuggest*QcFiltersResults()` as this can be used to perform filtering with custom thresholds.
- Removed the `consume=` option from `initializeSparseMatrixFromRds()`, as the potential damage from pass-by-reference mutations is too high for the minor improvement in performance.
- Added `allowNonFinite=` option to the `logNormCounts()` function to handle infinite and missing size factors.
- Added `allowZeros=` and `allowNonFinite=` options to the `groupedSizeFactors()` function to handle infinite and missing size factors.
  Both options are automatically set to `true` when calling `groupedSizeFactors()` from the `quickAdtSizeFactors()` function.

## 2.1.8

**Changes**

- Added a `cacheSize=` option to `initializeSparseMatrixFromHDF5()`, mostly to increase the cache size for awkward chunk sizes in dense HDF5 datasets.

## 2.1.7

**Changes**

- Ignore all MGI identifiers in `guessFeatures()` to avoid confusing them with human gene symbols.

## 2.1.6

**Changes**

- Ignore all VEGA identifiers in `guessFeatures()` to avoid confusing them with human gene symbols.

## 2.1.5

**Changes**

- Added the `subsetRow=` and `subsetColumn=` options to enable loading of a subset of rows/columns from `initializeSparseMatrixFromHDF5()`.

## 2.1.4

**Changes**

- Ignore non-string values in the `features=` for `guessFeatures()`.

## 2.1.3

**Changes**

- Preserve placeholder entries for factor indices in `resetLevels()`.

## 2.1.2

**New**

- Added a `resetLevels()` function to change the levels of an existing factor.

**Changes**

- Improved the predictability of level ordering in `convertToFactor()`.
  All-string/all-number levels that are inferred from the array are now sorted.
  Users may also pass in their own `levels`.

## 2.1.1

**Changes**

- Improved the intersection of feature identifiers in `labelCells()` and `integrateCellLabels()`.
  Reference features may now contain synonyms, and if feature identifiers are duplicated, only the first occurrence is used.

## 2.1.0

**New**

- Added an `aggregateAcrossCells()` function to aggregate expression values across groups of cells.
  This is typically used to obtain cluster-level summaries for plotting or per-cluster analyses. 

**Changes**

- Provide more details (scores, fine-tuning deltas) in `labelCells()` and `integrateCellLabels()`.
  These functions now return full-fledged objects that need to be explicitly freed after use.

## 2.0.3

**New**

- Added a `factorize()` function to convert an arbitrary array into an R-style factor.
  This provides a superset of the functionality of the `convertBlock()` function. 

**Changes**

- `convertBlock()` now raises a warning upon detecting `null` or `NaN` values.

## 2.0.2

**Changes**

- Reduce the impact of duplicated feature identifiers in `guessFeatures()`.
  This avoids treating strings like "Chr1" as mouse identifiers.

## 2.0.1

**Changes**

- Greatly expanded the range of species that can be guessed in `guessFeatures()`.
  Also added the ability to force the function to report taxonomy IDs instead of common names for human/mouse.

## 2.0.0

**New**

- Added `perCellCrisprQcMetrics()` and `suggestCrisprQcFilters()`,
  to compute the QC metrics and filters for CRISPR guide count data.
- Added `scoreFeatureSet()` to compute per-cell scores for a feature set's activity.
- Added `hypergeometricTest()`, `testFeatureSetEnrichment()` and `remapFeatureSets()`,
  to compute simple enrichment p-values for the top markers in each feature set.
- Added `computeTopThreshold()` to more easily identify the top markers for 
- Added `writeSparseMatrixToHdf5()` to dump a `ScranMatrix` back into a HDF5 file.
- Added `centerSizeFactors()` to allow users to center the size factors manually.

**Changes**

- Renamed `perCell*QcFilters()` functions to `suggest*QcFilters()`.
  These now return a `Suggest*QcFiltersResults` object containing filter thresholds but not the discard vector itself.
  Instead, the `filter()` method can be called with a `PerCell*QcMetricsResults()` object to generate a discard vector,
  either for the same dataset or for a related set of cells.
  The filter thresholds themselves can also be adjusted by the application before calling `filter()`.
  All in all, this provides greater flexibility for applications to perform quality control.
- Renamed `perCellQCMetrics()` to `perCellRnaQcMetrics()` (similarly for the name of the corresponding result class).
  This is more consistent with the namings of the QC functions for the other modalities.
- Getters for empty results will now return `null` if the corresponding field has not been filled,
  either using a dedicated setter or by extracting a memory view with `fillable: true`.
  This allows applications to fail gracefully upon encountering an object where the required fields have not been filled.
- Added a `leidenModularityObjective` option to `clusterSNNGraph()`, to use the modularity as the objective function.
  This allows for a more stable interpretation of the magnitude of the resolution.
- Separated resolution arguments to `multiLevelResolution` and `leidenResolution` for `clusterSNNGraph()`,
  allowing them to have different defaults.
  This is especially relevant when `leidenModularityObjective = false`.
- Removed the `updateRowIdentities()` function, as this has little relation with other functions in **scran.js**.
- Updated to the latest version of **libscran** (and thus **igraph**, which changes some of the clustering outputs).
- Added a `minimum=` argument to `chooseHVGs()` to avoid choosing HVGs with negative residuals.
- Modified `summary=` argument to accept a string in `ScoreMarkerResults`, which is more interpretable.
- Support calculation of median and maximum effect sizes in `scoreMarkers()`.
- Pass along `block=` to the internal PCA in `quickAdtSizeFactors()`. 
- Allow size factor centering to turned off in `logNormCounts()`, in case the input size factors are already centered.
- Ignore `null`s in the feature ID vectors in `buildLabelledReference()`.
- Removed deprecated functionality from previous version:
  - Removed `ScranMatrix.isPermuted()`.
  - `clusterSNNGraph()` no longer accepts integer arguments for `scheme=`.
  - Removed `initializeSparseMatrixFromMatrixMarketBuffer()`.
  - `runPCA()` no longer accepts `blockMethod="block"`.
  - Removed `safeFree()`.

## 1.2.1

**New**

- Added more `empty*()` functions to construct empty instances of various result objects.
  This is useful for mimicking the output of functions without actually running them.

**Changes**

- Added more methods and options for the `ClusterSNNGraph*Results` classes,
  mostly to facilitate filling of empty objects.

## 1.2.0

**Changes**

- Added the `lfcThreshold` and `computeAuc` options to the `scoreMarkers()` function.
  In particular, skipping the AUCs can improve speed and memory efficiency if they are not required.
- Switched the default `referencePolicy` to `"max-rss"` in the `mnnCorrect()` function.
  This favors the use of more heterogeneous batches as the initial reference.
- Actually exported the `ScranMatrix` class.

## 1.1.0

**Changes**

- Added a `forceInteger` option to (almost) all matrix initialization functions.
  Setting this to `false` will preserve any floating-point representations, e.g., for normalized expression data.
  This defaults to `true` for back-compatibility, where floats are coerced to integer by truncation.

## 1.0.2

**Changes**

- Fixed `readFile()` to actually return content in the browser.
- Removed the not-to-be-used virtual file system utilities.

## 1.0.1

**New**

- Added `chooseTemporaryPath()` to obtain a temporary file path on both browsers and Node.js.

**Changes**

- All file-related utilities (`writeFile()`, `removeFile()`, `readFile()` and `fileExists()`) now operate as expected on Node.js.

## 1.0.0

**New**

- Added `realizeFile()` to prepare a file for reading into other functions, regardless of whether the call is in a Node.js or browser context.
  For browsers, this creates a file on the virtual file system; for Node.js, it either uses the supplied path or it creates a temporary file.
- Added `extractHdf5MatrixDetails()` to preview the format and dimensions of a HDF5-based matrix.

**Changes**

- Removed `quickSliceArray()`.
  Users should instead use the `SLICE()` function from the [**bioconductor**](https://npmjs.org/package/bioconductor) package.
- Removed all array collection-related functions. 
  Users should instead use the `DataFrame` class and related methods from the **bioconductor** package.
- Removed `splitByFactor()`.
  Users should instead use the `presplitFactor()` function from the **bioconductor** package.

## 0.6.0

**New**

- Support parsing and inspection data in RDS files (generated by R's `saveRDS()` function) via the new `readRds()` function.
- Added the `initializeSparseMatrixFromRds()` function, which does exactly as advertised.

## 0.5.1

**Changes**

- Updated the underlying C++ libraries to their latest versions.
  This should improve memory efficiency.

## 0.5.0

**New**

- HDF5 handles now support reading and writing of attributes via `readAttribute()` and `writeAttribute()` methods.
  An extra `attributes` member is available for listing the available attributes. 
- ScranMatrix objects can be used in more delayed operations via the new `delayedArithmetic()`, `delayedMath()`, `rbind()` and `transpose()` functions.
  All of these operations can be performed in place or can generate a new ScranMatrix.
- Subsetting of a ScranMatrix via `subsetRows()` or `subsetColumns()` can now be done in place with the new `inPlace=` option.
- Added a `quickSliceArray()` function to slice a (Typed)Array while preserving its type.

**Changes**

- The `initializeSparseMatrix*()` functions now return an object with a `row_ids=` array.
  This makes it more explicit that a reorganization of the row identities was performed.
- The `identities()` and `isReorganized()` methods for a ScranMatrix have been soft-deprecated; the latter will now always return `false`.
  This simplifies downstream operations, which no longer need to preserve consistency in the identities to produce a valid ScranMatrix.
- `updateRowIdentities()` now requires a row identity vector instead of a ScranMatrix in its first argument.
- `matchVectorToRowIdentities()` has been removed, along with other deprecated functions based on manipulation of row identities.

## 0.4.2

**New**

- Added a `maximumThreads()` function to query the maximum number of threads specified at module initialization.
- All parallelizable functions now accept a `numberOfThreads=` option to control the number of threads.

## 0.4.1

**New**

- Added a `layered=` option in various `initializeSparseMatrix*()` functions.
  This enables direct loading of sparse matrices without row reorganization, for simplicity at the cost of memory efficiency.

## 0.4.0

**New**

- Added the `extractMatrixMarketDimensions()` function to easily get dimensions without loading the entire file.

**Changes**

- Renamed the MatrixMarket reader to `initializeSparseMatrixFromMatrixMarket()`.
  This function now supports file path inputs, which avoids the need to buffer the entire file in Node.js.
- Functions that accept an optional `buffer =` argument will now return it directly if `buffer` is non-`null` and the output type is a WasmArray.
  Otherwise, if the output type is a TypedArray, functions will now return a TypedArray view on a non-null input `buffer`.
  This aims to provide some kind of sensible output value rather than just `undefined`.

## 0.3.0

**New**

- Exported the `free()` function as a replacement for `safeFree()`.
- Added the `subsetBlock()` function for general subsetting of the blocking factor.
- Added a `allowZeros=` option to gracefully handle size factors of zero in `logNormCounts()`.

**Changes**

- Renamed some classes for consistency with the `*Results` naming scheme.
- All `*Results` and `*Matrix` instances will automatically free their memory upon garbage collection if `free()` has not already been called.
- `subsetArrayCollection()` will now check for correct array length before subsetting.

## 0.2.5

**New**

- Exported the `safeFree()` function for fail-safe freeing of **scran.js** objects.
- Added a `listMito()` function to list mitochondrial genes in mouse or human.
- Added a `validateArrayCollection()` function to validate equilength array collections.
- `subsetArrayCollection()` can now be used to subset based on a filtering vector.

**Changes**

- Functions involving the **scran.js** virtual filesystem (e.g., `writeFile()`) now throw errors when attempted in a Node context.
- The setting of `localFile=` in `initialize()` is ignored outside of a Node context.
- `combineArrayCollections()` will attempt to preserve TypedArray types across input collections.

## 0.2.4

**New**

- Added a MultiMatrix class to handle memory management in multi-modal scenarios. 

**Changes**

- `subsetRows()` can now directly return a MultiMatrix.

## 0.2.3

**Changes**

- Updated **libscran** dependency for `scoreMarkers()` bugfix when group and block are confounded.

## 0.2.2

**Changes**

- `blockMethod: "block"` has been renamed to `blockMethod: "regress"` in `runPCA()`, for clarity.
- More checks for valid `blockMethod=` being passed to `runPCA()`.

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
