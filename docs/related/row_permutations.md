# Permuted rows in layered matrices

Rows of the dataset are permuted by `initializeSparseMatrix*()` functions to achieve a memory-efficient layout in `mat`.
Specifically, low-abundance genes are grouped together so that their counts can be efficiently stored as 8-bit integers;
moderate-abundance genes are grouped together for 16-bit storage;
and everything else is stored as a 32-bit integer.
We refer to this layout as a "layered sparse matrix", and is used by default in all `initializeSparseMatrix*()` functions.

```js
let input = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer);
let mat = input.matrix;
let ids = input.row_ids;
```

The identities of the permuted rows are recorded in the `row_ids` property.
This is an `Int32Array` where the `i`-th element specifies the original row index (i.e., if no permutation was applied) for the `i`-th row in `mat`,
We can use this to ensure that other gene-level annotation is correctly reordered, e.g., by mapping an array of gene symbols to match up with the permuted order in the layered matrix.

```js
let reorg_symb = [];
ids.forEach(x => { reorg_symb.push(symb[x]); });

// Or, more directly:
let reorg_symb2 = scran.quickSliceArray(ids, symb);
```

All gene-based results computed from a layered sparse matrix (e.g., from `modelGeneVar()` or `scoreMarkers()`) are reported in the permuted order,
so be sure to apply the same permutation to the gene names/symbols in order to match them up with the results correctly.

If this seems like too much of a hassle to save memory, users can turn off the layered mode via the `layered` option. 
This will force the function to load the sparse matrix without any reorganization,
simplifying downstream book-keeping at the cost of increased memory usage.

```js
let input = scran.initializeSparseMatrixFromMatrixMarketBuffer(buffer, { layered: false });
let mat = input.matrix;
let ids = input.row_ids; // null when layered: false.
```
