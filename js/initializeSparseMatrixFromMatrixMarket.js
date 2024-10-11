import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import { ScranMatrix } from "./ScranMatrix.js";

/** 
 * Initialize a sparse matrix from a buffer containing a MatrixMarket file.
 *
 * @param {Uint8WasmArray|Array|TypedArray|string} buffer Byte array containing the contents of a Matrix Market file with non-negative counts.
 * This can be raw text or Gzip-compressed.
 * 
 * Alternatively, this can be a string containing a file path to a MatrixMarket file.
 * On browsers, this should be a path in the virtual filesystem, typically created with {@linkcode writeFile}. 
 * @param {object} [options={}] - Optional parameters.
 * @param {?boolean} [options.compression="unknown"] - Whether the buffer is Gzip-compressed (`"gzip"`) or uncompressed (`"none"`).
 * If `"unknown"`, we detect this automatically from the magic number in the header.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, see [**tatami_layered**](https://github.com/tatami-inc/tatami_layered) for more details.
 *
 * @return {ScranMatrix} Matrix containing sparse data.
 */
export function initializeSparseMatrixFromMatrixMarket(x, { compression = "unknown", layered = true } = {}) {
    var buf_data;
    var output;

    try {
        if (typeof x !== "string") {
            buf_data = utils.wasmifyArray(x, "Uint8WasmArray");
            output = gc.call(
                module => module.initialize_from_mtx_buffer(buf_data.offset, buf_data.length, compression, layered),
                ScranMatrix
            );
        } else {
            output = gc.call(
                module => module.initialize_from_mtx_file(x, compression, layered),
                ScranMatrix
            );
        }

    } catch(e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(buf_data);
    }

    return output;
}

/** 
 * Extract dimensions and other details from a MatrixMarket file.
 *
 * @param {Uint8WasmArray|Array|TypedArray|string} buffer Byte array containing the contents of a Matrix Market file with non-negative counts.
 * This can be raw text or Gzip-compressed.
 * 
 * Alternatively, this can be a string containing a file path to a MatrixMarket file.
 * On browsers, this should be a path in the virtual filesystem, typically created with {@linkcode writeFile}. 
 * @param {object} [options={}] - Optional parameters.
 * @param {?boolean} [options.compression="unknown"] - Whether the buffer is Gzip-compressed (`"gzip"`) or uncompressed (`"none"`).
 * If `"unknown"`, we detect this automatically from the magic number in the header.
 *
 * @return {object} An object containing the number of `rows`, `columns` and `lines` in the matrix.
 */
export function extractMatrixMarketDimensions(x, { compression = "unknown" } = {}) {
    var buf_data;
    var stats = utils.createFloat64WasmArray(3);
    let output = {};

    try {
        if (typeof x !== "string") {
            buf_data = utils.wasmifyArray(x, "Uint8WasmArray");
            wasm.call(module => module.read_header_from_mtx_buffer(buf_data.offset, buf_data.length, compression, stats.offset));
        } else {
            wasm.call(module => module.read_header_from_mtx_file(x, compression, stats.offset));
        }

        let sarr = stats.array();
        output.rows = sarr[0];
        output.columns = sarr[1];
        output.lines = sarr[2];

    } finally {
        utils.free(buf_data);
        utils.free(stats);
    }

    return output;
}
