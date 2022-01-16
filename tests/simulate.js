import * as scran from "../js/index.js";

export function simulateMatrix(nrow, ncol, density = 0.2, maxValue = 10) {
    var buffer = new scran.Int32WasmArray(nrow * ncol);
    let output;

    try {
        var x = buffer.array();
        for (var r = 0; r < nrow; r++) {
            for (var c = 0; c < ncol; c++) {
                if (Math.random() <= density) {
                    x[r + c * nrow] = Math.random() * maxValue;
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
