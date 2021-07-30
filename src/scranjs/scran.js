class scran {
  constructor(options, wasm) {
    // wasm module initialized in the browser
    this.wasm = wasm;

    // holds any options
    this.options = options;

    // keep track of data objects
    this._internalMemTracker = {};

    this._heapMap = {
      Float64Array: {
        size: 8,
        wasm: "HEAPF64",
      },
      Float32Array: {
        size: 4,
        wasm: "HEAPF32",
      },
      Uint8Array: {
        size: 1,
        wasm: "HEAPU8",
      },
      Int32Array: {
        size: 4,
        wasm: "HEAP32",
      },
      Uint32Array: {
        size: 4,
        wasm: "HEAPU32",
      },
    }
  }

  loadData(data, nrow, ncol) {
    // this.data = data;
    // for now generate random data
    this.nrow = nrow;
    this.ncol = ncol;
    this.data = this.generateData(nrow * ncol);

    console.log(this.data);

    this.matrix = this.getNumMatrix(this.data, nrow, ncol);
    this.nrow = this.matrix.nrow();
    this.ncol = this.matrix.ncol();
    console.log(this.matrix);
  }

  loadDataFromPath(ptr, size, compressed) {
    this.matrix = Module.read_matrix_market(ptr, size, compressed);
    console.log(this.matrix);
    this.nrow = this.matrix.nrow();
    this.ncol = this.matrix.ncol();
    console.log(this.matrix.nrow());
    console.log(this.matrix.ncol());
  }

  getRandomArbitrary() {
    return Math.random();
  }

  setZero(arr) {
    arr.vector.set(arr.vector.map(() => 0));
  }

  generateData(size) {
    const arr = this.createMemorySpace(size, "Float64Array", "oData");
    arr.vector.set(arr.vector.map(() => this.getRandomArbitrary()));
    return arr;
  }

  // from epiviz
  _generateGuid() {
    var chars =
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var result = "";
    var size = 5;

    for (var i = 0; i < size; ++i) {
      result += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return "var-" + result;
  }

  // pretty much the allocators
  createMemorySpace(size, type, key) {
    if (!key) {
      key = this._generateGuid();
    }

    if (type in this._heapMap) {
      const typeOpt = this._heapMap[type];
      let ptr = this.wasm._malloc(size * typeOpt["size"]);

      let x = {
        ptr: ptr,
        size: size,
        type: type,
        // vector: arr,
      };

      // this.setZero(x);
      this._internalMemTracker[key] = x;

      return x;
    }
  }

  getMemorySpace(key) {
    return this._internalMemTracker[key];
  }

  getVector(key) {

    const obj = this.getMemorySpace(key);
    const type = obj["type"];
    const ptr = obj["ptr"];
    const size = obj["size"];
    const typeOpt = this._heapMap[type];

    let arr;

    if (type == "Float64Array") {
      arr = new Float64Array(
        this.wasm[typeOpt["wasm"]].buffer,
        ptr,
        size
      );
    } else if (type == "Float32Array") {
      arr = new Float32Array(
        this.wasm[typeOpt["wasm"]].buffer,
        ptr,
        size
      );
    } else if (type == "Uint8Array") {
      arr = new Uint8Array(
        this.wasm[typeOpt["wasm"]].buffer,
        ptr,
        size
      );
    } else if (type == "Int32Array") {
      arr = new Int32Array(
        this.wasm[typeOpt["wasm"]].buffer,
        ptr,
        size
      );
    } else if (type == "Uint32Array") {
      arr = new Uint32Array(
        this.wasm[typeOpt["wasm"]].buffer,
        ptr,
        size
      );
    }

    return arr;
  }

  freeMemorySpace(key) {
    this.wasm._free(this._internalMemTracker[key][0]);
  }

  getNumMatrix(data, nrow, ncol) {
    var instance = new this.wasm.NumericMatrix(
      this.nrow,
      this.ncol,
      this.data.ptr
    );

    return instance;
  }

  // pretty much from PR #1 Aaron's code
  qcMetrics() {
    var sums = this.createMemorySpace(this.ncol, "Float64Array", "qc_sums");

    var detected = this.createMemorySpace(
      this.ncol,
      "Int32Array",
      "qc_detected"
    );
    var subsets = this.createMemorySpace(this.ncol, "Uint8Array", "qc_subsets");

    // subsets.vector[0] = 0;
    // subsets.vector[3] = 0;
    // subsets.vector[10] = 0;

    var subsets_array = this.createMemorySpace(
      1,
      "Uint32Array",
      "qc_subsets_array"
    );
    var arr_sub_array = this.getVector("qc_subsets_array");
    arr_sub_array[0] = subsets.ptr;

    var proportions = this.createMemorySpace(
      this.ncol,
      "Float64Array",
      "qc_proportions"
    );
    var proportions_array = this.createMemorySpace(
      1,
      "Uint32Array",
      "qc_proportions_array"
    );
    var arr_proportions_array = this.getVector("qc_proportions_array");
    arr_proportions_array[0] = proportions.ptr;

    this.wasm.per_cell_qc_metrics(
      this.matrix,
      1,
      subsets_array.ptr,
      sums.ptr,
      detected.ptr,
      proportions_array.ptr
    );

    var discard_sums = this.createMemorySpace(
      this.ncol,
      "Uint8Array",
      "disc_qc_sums"
    );
    var discard_detected = this.createMemorySpace(
      this.ncol,
      "Uint8Array",
      "disc_qc_detected"
    );
    var discard_proportions = this.createMemorySpace(
      this.ncol,
      "Uint8Array",
      "disc_qc_proportions"
    );
    var discard_overall = this.createMemorySpace(
      this.ncol,
      "Uint8Array",
      "disc_qc_overall"
    );

    var threshold_sums = this.createMemorySpace(
      1,
      "Float64Array",
      "threshold_qc_sums"
    );
    var threshold_detected = this.createMemorySpace(
      1,
      "Float64Array",
      "threshold_qc_detected"
    );
    var threshold_proportions = this.createMemorySpace(
      1,
      "Float64Array",
      "threshold_qc_proportions"
    );

    this.wasm.per_cell_qc_filters(
      this.ncol,
      sums.ptr,
      detected.ptr,
      0,
      0,
      false,
      0,
      1, // should set to 3, using 1 to see if the output works.

      discard_sums.ptr,
      discard_detected.ptr,
      0,
      discard_overall.ptr,
      threshold_sums.ptr,
      threshold_detected.ptr,
      0
    );

    // console.log(discard_sums.vector);
    // console.log(threshold_sums.vector);
    // console.log(threshold_detected.vector);

    var filtered = this.wasm.filter_cells(this.matrix,
    discard_overall.ptr, false);
    console.log(filtered.ncol()); // should be less.

    this.filteredMatrix = filtered;
    this.nrow = this.filteredMatrix.nrow();
    this.ncol = this.filteredMatrix.ncol();

    // console.log(sums.vector);
    // console.log(detected.vector);
    // console.log(proportions.vector);
    
    var sums_vector = this.getVector("qc_sums");
    var detected_vector = this.getVector("qc_detected");
    // var proportions_vector = this.getVector("qc_proportions");
    // var discard_sums_vector = this.getVector("disc_qc_sums");
    // var threshold_sums_vector = this.getVector("threshold_qc_sums");
    // var threshold_detected_vector = this.getVector("threshold_qc_detected");


    return {
      "sums": sums_vector,
      "detected": detected_vector,
      // "proportion": proportions_vector,
      // "discarded_sums": discard_sums_vector,
      // "threshold_sums": threshold_sums_vector,
      // "threshold_detected": threshold_detected_vector
    }
  }

  // qcFilters() {

  //   var sums = this.getMemorySpace("qc_sums");
  //   var detected = this.getMemorySpace("qc_detected");

  //   var discard_sums = this.createMemorySpace(
  //     this.ncol,
  //     "Uint8Array",
  //     "disc_qc_sums"
  //   );
  //   var discard_detected = this.createMemorySpace(
  //     this.ncol,
  //     "Uint8Array",
  //     "disc_qc_detected"
  //   );
  //   var discard_proportions = this.createMemorySpace(
  //     this.ncol,
  //     "Uint8Array",
  //     "disc_qc_proportions"
  //   );
  //   var discard_overall = this.createMemorySpace(
  //     this.ncol,
  //     "Uint8Array",
  //     "disc_qc_overall"
  //   );

  //   var threshold_sums = this.createMemorySpace(
  //     1,
  //     "Float64Array",
  //     "threshold_qc_sums"
  //   );
  //   var threshold_detected = this.createMemorySpace(
  //     1,
  //     "Float64Array",
  //     "threshold_qc_detected"
  //   );
  //   var threshold_proportions = this.createMemorySpace(
  //     1,
  //     "Float64Array",
  //     "threshold_qc_proportions"
  //   );

  //   this.wasm.per_cell_qc_filters(
  //     this.ncol,
  //     sums.ptr,
  //     detected.ptr,
  //     0,
  //     0,
  //     false,
  //     0,
  //     1, // should set to 3, using 1 to see if the output works.

  //     discard_sums.ptr,
  //     discard_detected.ptr,
  //     0,
  //     discard_overall.ptr,
  //     threshold_sums.ptr,
  //     threshold_detected.ptr,
  //     threshold_qc_proportions
  //   );

  //   console.log(discard_sums.vector);
  //   console.log(threshold_sums.vector);
  //   console.log(threshold_detected.vector);

  //   var filtered = this.wasm.filter_cells(this.matrix,
  //     discard_overall.ptr, false);
  //   console.log(filtered.ncol()); // should be less.

  //   this.filteredMatrix = filtered;
  //   this.nrow = this.filteredMatrix.nrow();
  //   this.ncol = this.filteredMatrix.ncol();

  //   // return {
  //   //   "sums": sums.vector,
  //   //   "detected": detected.vector,
  //   //   "proportion": proportions.vector
  //   // }

  //   // probably should delete all the vectors we made.
  //   // instance.delete();
  // }

  PCA() {
    this.n_pcs = 5;

    var sub = this.createMemorySpace(
      this.nrow,
      "Uint8Array",
      "subset_PCA"
    );

    // console.log(sub.vector);

    var pcs = this.createMemorySpace(
      this.ncol * this.n_pcs,
      "Float64Array",
      "mat_PCA"
    );

    var var_exp = this.createMemorySpace(
      this.n_pcs,
      "Float64Array",
      "var_exp_PCA"
    );

    // console.log(pcs.vector);
    // console.log(var_exp.vector);

    Module.run_pca(
      this.matrix,
      this.n_pcs, false, sub.ptr,
      false, pcs.ptr,
      var_exp.ptr);

    var pcs = this.getVector("mat_PCA");
    var var_exp = this.getVector("var_exp_PCA");

    // console.log(pcs.vector);
    console.log(var_exp.vector);

    return {
      // "pcs": pcs,
      "var_exp": var_exp
    }
  }

  cluster() {
    var clusters = this.createMemorySpace(
      this.ncol,
      "Int32Array",
      "clusters"
    );

    var arr_clus = this.getVector("clusters");
    arr_clus.set(arr_clus.map(() => 20));
    
    var pcs = this.getMemorySpace("mat_PCA");

    Module.cluster_snn_graph(this.n_pcs, this.ncol, pcs.ptr, 2, 0.5, clusters.ptr);
    // arr_clus.set(arr_clus.map(() => 20));
    var arr_clust = this.getVector("clusters");
    console.log(arr_clust);

    return {
      "clusters": arr_clust,
    }
  }
}

// export default scran;
