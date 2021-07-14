export class scran {
  constructor(data, nrow, ncol, options, wasm) {
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
    };

    // this.data = data;
    // for now generate random data
    this.nrow = nrow;
    this.ncol = ncol;
    this.data = this.generateData(nrow * ncol);

    console.log(this.data);
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

      let x = {
        pointer: ptr,
        size: size,
        vector: arr,
      };

      this.setZero(x);
      this._internalMemTracker[key] = x;

      return x;
    }
  }

  freeMemorySpace(key) {
    this.wasm._free(this._internalMemTracker[key][0]);
  }

  getNumMatrix(key) {
    var dmat = this.createMemorySpace(this.ncol * this.nrow, "Float64Array", "dataMat");

    var instance = new this.wasm.NumericMatrix(
      this.nrow,
      this.ncol,
      dmat.pointer
    );

    this.dataMat = instance;

    return instance;
  }

  // pretty much from PR #1 Aaron's code
  QC() {
    var sums = this.createMemorySpace(this.ncol, "Float64Array", "qc_sums");
    
    var detected = this.createMemorySpace(
      this.ncol,
      "Int32Array",
      "qc_detected"
    );
    var subsets = this.createMemorySpace(this.ncol, "Uint8Array", "qc_subsets");

    subsets.vector[0] = 1;
    subsets.vector[3] = 1;
    subsets.vector[10] = 1;

    var subsets_array = this.createMemorySpace(
      1,
      "Uint32Array",
      "qc_subsets_array"
    );
    subsets_array.vector[0] = subsets.pointer;

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
    proportions_array.vector[0] = proportions.pointer;

    this.wasm.per_cell_qc_metrics(
      this.dataMat,
      1,
      subsets_array.pointer,
      sums.pointer,
      detected.pointer,
      proportions_array.pointer
    );
    console.log(sums.vector);
    console.log(detected.vector);
    console.log(proportions.vector);

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

    this.wasm.per_cell_qc_filters(
      this.ncol,
      sums.pointer,
      detected.pointer,
      0,
      0,
      false,
      0,
      1, // should set to 3, using 1 to see if the output works.

      discard_sums.pointer,
      discard_detected.pointer,
      0,
      discard_overall.pointer,

      threshold_sums.pointer,
      threshold_detected.pointer,
      0
    );

    console.log(discard_sums.vector);
    console.log(threshold_sums.vector);
    console.log(threshold_detected.vector);

    var filtered = this.wasm.filter_cells(this.dataMat, discard_overall.pointer, false);
    console.log(filtered.ncol()); // should be less.

    // probably should delete all the vectors we made.
    // instance.delete();
  }
}
