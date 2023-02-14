import * as scran from "../js/index.js";

export function simulateSparseData(primary, secondary, injectBigValues = false) {
    let data = [];
    let indices = [];
    let indptrs = new Uint32Array(primary + 1);
    indptrs[0] = 0;

    for (var i = 0; i < primary; i++) {
        indptrs[i+1] = indptrs[i];

        for (var j = 0; j < secondary; j++) {
            if (Math.random() < 0.05) { // 5% density
                indices.push(j);
                indptrs[i+1]++;

                let candidate = Math.random() * 100; // i.e., in (0, 100)
                if (injectBigValues) {
                    if (j % 2 == 0) {
                        candidate *= 10;
                        candidate += 1000; // i.e., in (1000, 2000)
                    } else if (j % 4 == 0) {
                        candidate *= 1000;
                        candidate += 100000; // i.e., in (100000, 200000)
                    }
                }

                data.push(candidate);
            }
        }
    }

    let data2 = new Uint16Array(data.length);
    data2.set(data);
    let indices2 = new Int32Array(indices.length);
    indices2.set(indices);
    let indptrs2 = new Uint32Array(indptrs.length);
    indptrs2.set(indptrs);

    return {
        "data": data2,
        "indices": indices2,
        "indptrs": indptrs2
    };
}

export function simulateMatrix(numberOfRows, numberOfColumns, density = 0.2, maxValue = 10, forceInteger = true) {
    var buffer;
    if (forceInteger) {
        buffer = scran.createInt32WasmArray(numberOfRows * numberOfColumns);
    } else {
        buffer = scran.createFloat64WasmArray(numberOfRows * numberOfColumns);
    }

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

        output = scran.initializeSparseMatrixFromDenseArray(numberOfRows, numberOfColumns, buffer, { forceInteger });
    } finally {
        buffer.free();
    }

    return output.matrix;
}

export function simulateDenseMatrix(numberOfRows, numberOfColumns) {
    var buffer = scran.createFloat64WasmArray(numberOfRows * numberOfColumns);

    let arr = buffer.array();
    arr.forEach((x, i) => {
        arr[i] = Math.random();
    });

    return scran.initializeDenseMatrixFromDenseArray(numberOfRows, numberOfColumns, buffer);
}

export function simulatePermutedMatrix(numberOfRows, numberOfColumns, density = 0.2) {
    var buffer = scran.createInt32WasmArray(numberOfRows * numberOfColumns);
    let output;

    try {
        var x = buffer.array();
        for (var r = 0; r < numberOfRows; r++) {
            let choice = [1, 1000, 1000000][Math.floor(Math.random() * 3)];

            for (var c = 0; c < numberOfColumns; c++) {
                if (Math.random() <= density) {
                    x[r + c * numberOfRows] = choice;
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
