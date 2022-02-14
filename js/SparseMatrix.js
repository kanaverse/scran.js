import { Float64WasmArray, Int32WasmArray } from "./WasmArray.js";

/**
 * Wrapper around a sparse matrix allocated on the Wasm heap.
 */
export class SparseMatrix {
    /**
     * @param {Object} raw Raw matrix object created on the Wasm heap.
     *
     * This should not be called directly by developers,
     * who should instead use functions that initialize a sparse matrix, e.g., `initializeSparseMatrixFromCompressedVectors()`.
     */
    constructor(raw) {
        this.matrix = raw;
        return;
    }

    /**
     * @return Number of rows in the matrix.
     */
    numberOfRows() {
        return this.matrix.nrow();
    }

    /**
     * @return Number of columns in the matrix.
     */
    numberOfColumns() {
        return this.matrix.ncol();
    }

    /**
     * @param {number} i - Index of the row to extract.
     * This should be a non-negative integer less than `numberOfRows()`.
     * @param {Object} [options] - Optional parameters.
     * @param {Float64WasmArray} [options.buffer] - Buffer to extract into.
     * If supplied, this should have length equal to `numberOfColumns()`. 
     *
     * @return
     * If `buffer` is not supplied, a `Float64Array` is returned containing the contents of row `i`.
     * Otherwise, `buffer` is filled with row `i` and nothing is returned.
     */
    row(i, { buffer = null } = {}) {
        if (buffer != null) {
            this.matrix.row(i, buffer.offset);
            return;
        } else {
            var output;
            buffer = new Float64WasmArray(this.matrix.ncol());
            try {
                this.matrix.row(i, buffer.offset);
                output = buffer.slice();
            } finally {
                buffer.free();
            }
            return output;
        }
    }

    /**
     * @param {number} i - Index of the column to extract.
     * This should be a non-negative integer less than `numberOfColumns()`.
     * @param {Object} [options] - Optional parameters.
     * @param {Float64WasmArray} [options.buffer] - Buffer to extract into.
     * If supplied, this should have length equal to `numberOfRows()`. 
     *
     * @return
     * If `buffer` is not supplied, a `Float64Array` is returned containing the contents of column `i`.
     * Otherwise, `buffer` is filled with column `i` and nothing is returned.
     */
    column(i, { buffer = null } = {}) {
        if (buffer != null) {
            this.matrix.column(i, buffer.offset);
            return;
        } else {
            var output;
            buffer = new Float64WasmArray(this.matrix.nrow());
            try {
                this.matrix.column(i, buffer.offset);
                output = buffer.slice();
            } finally {
                buffer.free();
            }
            return output;
        }
    }

    /** 
     * Free the memory on the Wasm heap for this matrix.
     * This invalidates this object and all of its references.
     */
    free() {
        if (this.matrix !== null) {
            this.matrix.delete();
            this.matrix = null;
        }
        return;
    }
}

/**
 * Wrapper around a layered sparse matrix allocated on the Wasm heap.
 * This permutes the rows to achieve a more memory-efficient representation.
 *
 * @augments SparseMatrix
 */
export class LayeredSparseMatrix extends SparseMatrix {
    /**
     * @param {Object} raw Raw matrix object created on the Wasm heap.
     *
     * This should not be called directly by developers.
     * Rather it is called by functions that initialize a sparse matrix, e.g., `initializeSparseMatrixFromCompressed()`.
     */
    constructor(raw) {
        super(raw);
        return;
    }

    /**
     * @param {Object} [options] - Optional parameters.
     * @param {Int32WasmArray} [options.buffer] Buffer to extract into.
     * If supplied, this should have length equal to `numberOfRows()`. 
     *
     * @return 
     * If `buffer` is not supplied, a `Int32Array` is returned containing the permutation vector.
     * Otherwise, `buffer` is filled with the permutation vector and nothing is returned.
     *
     * The permutation vector represents the permutation should be applied to the rows to obtain the original row order.
     * That is, for a permutation array `x`, `x[i]` is the new row index for the old row `i`.
     */
    permutation({ buffer = null } = {}) {
        if (buffer != null) {
            this.matrix.permutation(buffer.offset);
            return;
        } else {
            var output;
            buffer = new Int32WasmArray(this.matrix.nrow());
            try {
                this.matrix.permutation(buffer.offset);
                output = buffer.slice();
            } finally {
                buffer.free();
            }
            return output;
        }
    }
}
