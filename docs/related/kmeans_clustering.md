# Using k-means for clustering

For a faster alternative to the graph-based clustering algorithms, we can try using the k-means method.
We perform k-means clustering on the PC matrix, so the output of `scran.runPCA()` can be directly passed to the function.
We need to specify the number of clusters - in this case, 20.

```js
let clustering = scran.clusterKmeans(pcs, 20);
```

We use PCA partitioning as the default initialization approach, which is more-or-less deterministic.
However, advanced users can play around with other initialization methods and seeds:

```js
let clustpp = scran.clusterKmeans(pcs, 20, { initMethod: "kmeans++", initSeed: 42 });
```
