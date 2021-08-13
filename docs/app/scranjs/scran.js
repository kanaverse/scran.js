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

    this.genes = null;
    this.barcodes = null;
  }

  loadData(data, nrow, ncol) {
    // this.data = data;
    // for now generate random data
    this.data = this.generateData(nrow * ncol);

    console.log(this.data);

    this.matrix = this.getNumMatrix(this.data, nrow, ncol);
    console.log(this.matrix);
  }

  loadDataFromPath(ptr, size, compressed) {
    this.matrix = Module.read_matrix_market(ptr, size, compressed);
  }

  getRandomArbitrary() {
    return Math.random() * 100;
  }

  setZero(arr) {
    arr.vector.set(arr.vector.map(() => 0));
  }

  generateData(size) {
    const arr = this.createMemorySpace(size, "Float64Array", "oData");
    var vec = this.getVector("oData");
    vec.set(vec.map(() => this.getRandomArbitrary()));
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

  getVector(key, which = null, dim = null) {
    const obj = this.getMemorySpace(key);
    const type = obj["type"];
    const typeOpt = this._heapMap[type];
    var ptr = obj["ptr"];
    var size = obj["size"];

    if (dim != null) {
      if (!Array.isArray(dim)) {
        dim = [dim];
      }
      if (!Array.isArray(which)) {
        which = [which];
      }
      if (dim.size != which.size) {
        throw "'dim' and 'which' do not have the same length";
      }

      var vec_size = size / dim.reduce((a, b) => a * b);
      var multiplier = vec_size;
      for (var i = 0; i < which.length; i++) {
        ptr += multiplier * which[i];
        multiplier *= dim[i];
      }

      size = vec_size;
    }

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
      nrow,
      ncol,
      data.ptr
    );

    return instance;
  }

  // pretty much from PR #1 Aaron's code
  qcMetrics(nmads) {
    var nsubsets = 1;
    var subsets = this.createMemorySpace(
      this.matrix.nrow() * nsubsets,
      "Uint8Array",
      "qc_subsets"
    );

    // Testing:
    var subvec = this.getVector("qc_subsets");
    subvec.set(subvec.map(() => 0));
    // subvec[0] = 1;
    // subvec[1] = 1;
    // subvec[2] = 1;
    // subvec[this.matrix.ncol() + 2] = 1;
    // subvec[this.matrix.ncol() + 3] = 1;
    // subvec[this.matrix.ncol() + 4] = 1;
    // subvec[this.matrix.ncol() + 5] = 1;
    // console.log(this.getVector("qc_subsets", 0, 2));
    // console.log(this.getVector("qc_subsets", 1, 2));

    var metrics_output = this.wasm.per_cell_qc_metrics(this.matrix, nsubsets, subsets.ptr);
    this.qc_metrics = {
        "sums": metrics_output.sums().slice(),
        "detected": metrics_output.detected().slice(),
        "proportion": metrics_output.subset_proportions(0).slice() // TODO: generalize for multiple subsets.
    };

    var filter_output = this.wasm.per_cell_qc_filters(metrics_output, false, 0, nmads);
    this.thresholds = [
        filter_output.thresholds_sums()[0],
        filter_output.thresholds_detected()[0],
        filter_output.thresholds_proportions(0)[0] // TODO: generalize...
    ];

    var filtered = this.wasm.filter_cells(this.matrix, filter_output.discard_overall().byteOffset, false);
    this.filteredMatrix = filtered;

    metrics_output.delete();
    filter_output.delete();

    return {
      "sums": this.qc_metrics.sums,
      "detected": this.qc_metrics.detected,
      "proportion": this.qc_metrics.proportion,
      "thresholds": {
        "sums": this.thresholds[0],
        "detected": this.thresholds[1],
        "proportion": this.thresholds[2]
      }
    }
  }

  filterCells() {
    var sums_vector = this.qc_metrics.sums;
    var detected_vector = this.qc_metrics.detected;
    var proportions_vector = this.qc_metrics.proportion;

    var discard_overall = this.createMemorySpace(
      this.matrix.ncol(),
      "Uint8Array",
      "disc_qc_filt"
    );

    var disc_vector = this.getVector("disc_qc_filt");

    for (var n = 0; n < this.matrix.ncol(); n++) {
      if (sums_vector[n] < this.thresholds[0] ||
        detected_vector[n] < this.thresholds[1] ||
        proportions_vector[n] > this.thresholds[2]) {
        disc_vector[n] = 1;
      } else {
        disc_vector[n] = 0;
      }
    }

    var filtered = this.wasm.filter_cells(this.matrix, discard_overall.ptr, false);
    this.filteredMatrix = filtered;
  }

  fSelection(span) {
    var means = this.createMemorySpace(this.filteredMatrix.nrow(),
      "Float64Array", "fsel_means");

    var means_array = this.createMemorySpace(1,
      "Uint32Array", "fsel_means_arr");

    var means_vec = this.getVector("fsel_means_arr");
    means_vec[0] = means.ptr;

    var vars = this.createMemorySpace(this.filteredMatrix.nrow(),
      "Float64Array", "fsel_vars");

    var vars_array = this.createMemorySpace(1,
      "Uint32Array", "fsel_vars_arr");

    var vars_vec = this.getVector("fsel_vars_arr");
    vars_vec[0] = vars.ptr;

    var fitted = this.createMemorySpace(this.filteredMatrix.nrow(),
      "Float64Array", "fsel_fitted");
    var fitted_array = this.createMemorySpace(1,
      "Uint32Array", "fsel_fitted_arr");

    var fitted_vec = this.getVector("fsel_fitted_arr");
    fitted_vec[0] = fitted.ptr;

    var resids = this.createMemorySpace(this.filteredMatrix.nrow(),
      "Float64Array", "fsel_resids");
    var resids_array = this.createMemorySpace(1,
      "Uint32Array", "fsel_resids_arr");

    var resids_vec = this.getVector("fsel_resids_arr");
    resids_vec[0] = resids.ptr;

    this.wasm.model_gene_var(this.filteredMatrix, false, 0,
      span, means.ptr,
      vars.ptr,
      fitted.ptr,
      resids.ptr);

    var means_vec2 = this.getVector("fsel_means");
    var vars_vec2 = this.getVector("fsel_vars");
    var fitted_vec2 = this.getVector("fsel_fitted");
    var resids_vec2 = this.getVector("fsel_resids");

    return {
      "means": means_vec2,
      "vars": vars_vec2,
      "fitted": fitted_vec2,
      "resids": resids_vec2,
      "genes": this.genes
    }
  }

  PCA(npc) {
    this.n_pcs = npc;

    var sub = this.createMemorySpace(
      this.filteredMatrix.nrow(),
      "Uint8Array",
      "subset_PCA"
    );

    // console.log(sub.vector);

    var pcs = this.createMemorySpace(
      this.filteredMatrix.ncol() * this.n_pcs,
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

    this.wasm.run_pca(
      this.filteredMatrix,
      this.n_pcs, false, sub.ptr,
      false, pcs.ptr,
      var_exp.ptr);

    var pcs = this.getVector("mat_PCA");
    var var_exp = this.getVector("var_exp_PCA");

    this.init_tsne = null;

    // console.log(pcs.vector);
    // console.log(var_exp.vector);

    return {
      // "pcs": pcs,
      "var_exp": var_exp
    }
  }

  tsne(perplexity, iterations) {
    var self = this;
    var tsne = this.createMemorySpace(
      this.filteredMatrix.ncol() * 2,
      "Float64Array",
      "tsne"
    );

    // console.log(this.getVector("mat_PCA"));
    var pcs = this.getMemorySpace("mat_PCA");

    if (!this.init_tsne) {
      this.init_tsne = this.wasm.initialize_tsne(
        pcs.ptr, this.n_pcs,
        this.filteredMatrix.ncol(),
        perplexity, false, tsne.ptr);
    }

    this.wasm.run_tsne(this.init_tsne, 300, tsne.ptr);
    console.log(this.init_tsne.iterations());
    this._lastIter = 0;

    var iterator = setInterval(() => {

      if (self.init_tsne.iterations() >= iterations) {
        clearInterval(iterator);
      }

      postMessage({
        type: "TSNE",
        resp: JSON.parse(JSON.stringify({
          "tsne": self.getVector("tsne"),
          "iteration": self.init_tsne.iterations()
        })),
        msg: `Success: TSNE done, ${self.filteredMatrix.nrow()}, ${self.filteredMatrix.ncol()}`
      });

      self.wasm.run_tsne(self.init_tsne, 300, tsne.ptr);
    }, 300);

    return {
      "tsne": self.getVector("tsne"),
      "iteration": self._lastIter
    }
  }

  cluster() {
    var pcs = this.getMemorySpace("mat_PCA");
    var clustering = this.wasm.cluster_snn_graph(this.n_pcs, this.filteredMatrix.ncol(), pcs.ptr, 2, 0.5);
    var arr_clust_raw = clustering.membership(clustering.best());
    console.log(arr_clust_raw);
    var arr_clust = arr_clust_raw.slice();
    clustering.delete();

    return {
      "tsne": this.getVector("tsne"),
      "clusters": arr_clust,
    }
  }

  umap() {
    var self = this;
    var mat_arr = [];
    for (var i = 0; i < this.filteredMatrix.nrow(); i++) {
      mat_arr.push(
        arr = new Float64Array(
          this.wasm["HEAPF64"].buffer,
          self.filteredMatrix.row(i),
          size
        )
      );
    }

    const umap = new UMAP();
    const nEpochs = umap.initializeFit(mat_arr);
    for (let i = 0; i < nEpochs; i++) {
      umap.step();
    }
    const embedding = umap.getEmbedding();

    return {
      "embedding": embedding,
    }
  }
}

// export default scran;
