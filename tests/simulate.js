import * as scran from "../js/index.js";

export function simulateMatrix(numberOfRows, numberOfColumns, density = 0.2, maxValue = 10) {
    var buffer = scran.createInt32WasmArray(numberOfRows * numberOfColumns);
    let output;

    try {
        var x = buffer.array();
        for (var c = 0; c < numberOfColumns; c++) {
            for (var r = 0; r < numberOfRows; r++) {
                if (Math.random() <= density) {
                    x[r + c * numberOfRows] = Math.random() * maxValue;
                } else {
                    x[r + c * numberOfRows] = 0; // need this, otherwise it would be uninitialized.
                }
            }
        }

        output = scran.initializeSparseMatrixFromDenseArray(numberOfRows, numberOfColumns, buffer);
    } finally {
        buffer.free();
    }

    return output;
}

export function simulateSubsets(numberOfRows, nsubsets, density = 0.05) {
    var output = new Array(nsubsets);
    for (var s = 0; s < nsubsets; s++) {
        var current = new Array(numberOfRows);
        for (var i = 0; i < numberOfRows; i++) {
            current[i] = Math.random() < density;
        }
        output[s] = current;
    }
    return output;
}

export function simulatePCs(ndim, ncells) {
    var buffer = scran.createFloat64WasmArray(ndim * ncells);
    try {
        var arr = buffer.array();
        arr.forEach((x, i) => arr[i] = Math.random());
    } catch (e) {
        buffer.free();
        throw e;
    }
    return buffer;
}

export function simulateIndex(ndim, ncells) {
    var index;
    var buffer = scran.createFloat64WasmArray(ndim * ncells);
    try {
        var arr = buffer.array();
        arr.forEach((x, i) => arr[i] = Math.random());
        index = scran.buildNeighborSearchIndex(buffer, { numberOfDims: ndim, numberOfCells: ncells });
    } finally {
        buffer.free();
    }
    return index;
}
