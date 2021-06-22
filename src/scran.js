class scran {
    constructor (data, options, wasm) {
        // wasm module initialized in the browser
        this.wasm = wasm;
        
        // this.data = data;
        // for now generate random data
        this.data = this.generateData(10 * 10);

        // holds any options
        this.options = options;

        // keep track of data objects
        this._internalMemTracker = {};

        this._heapMap = {
            "Float64Array": {
                "wasm": "HEAPF64"
            }, 
            "Float32Array": {
                "wasm": "HEAP32"
            }
        }
    }

    getRandomArbitrary() {
        return Math.random();
    }

    generateData(size) {
        const arr = this.createMemorySpace(size, Float64Array);
        arr.set(arr.map(() => this.getRandomArbitrary()));
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

    createMemorySpace(size, type, key) {

        if (!key) {
            key = this._generateGuid();
        }

        if (type == "Float64Array") {
            let ptr = wasm._malloc(size * 8);

            const arr = new Float64Array(
                this.wasm[this._heapMap[type]["wasm"]].buffer,
                ptr,
                size
            );

            this._internalMemTracker[key] = [ptr, size];

            return arr;
        }
    }
}