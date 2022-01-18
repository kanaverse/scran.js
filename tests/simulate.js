import * as scran from "../js/index.js";

export function simulateMatrix(nrow, ncol, density = 0.2, maxValue = 10) {
    var buffer = new scran.Int32WasmArray(nrow * ncol);
    let output;

    try {
        var x = buffer.array();
        for (var c = 0; c < ncol; c++) {
            for (var r = 0; r < nrow; r++) {
                if (Math.random() <= density) {
                    x[r + c * nrow] = Math.random() * maxValue;
                } else {
                    x[r + c * nrow] = 0; // need this, otherwise it would be uninitialized.
                }
            }
        }

        output = scran.initializeSparseMatrixFromDenseArray(nrow, ncol, buffer);
    } finally {
        buffer.free();
    }

    return output;
}

export function simulateSubsets(nrow, nsubsets, density = 0.05) {
    var output = new Array(nsubsets);
    for (var s = 0; s < nsubsets; s++) {
        var current = new Array(nrow);
        for (var i = 0; i < nrow; i++) {
            current[i] = Math.random() < density;
        }
        output[s] = current;
    }
    return output;
}

export function simulateIndex(ndim, ncells) {
    var index;
    var buffer = new scran.Float64WasmArray(ndim * ncells);
    try {
        var arr = buffer.array();
        arr.forEach((x, i) => arr[i] = Math.random());
        index = scran.buildNeighborSearchIndex(buffer, ndim, ncells);
    } finally {
        buffer.free();
    }
    return index;
}
