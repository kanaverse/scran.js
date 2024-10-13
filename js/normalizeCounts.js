import * as gc from "./gc.js";
import * as utils from "./utils.js";
import * as wa from "wasmarrays.js";
import * as wasm from "./wasm.js";

/**
 * Compute log-transformed normalized expression values.
 *
 * @param {ScranMatrix} x The count matrix, usually after filtering.
 * @param {object} [options={}] - Optional parameters.
 * @param {?(Float64WasmArray|Array|TypedArray)} [options.sizeFactors=null] - Array of positive numbers containing the size factor for each cell in `x`.
 * This should have length equal to the number of columns in `x`.
 * If centering is required, it should be applied with {@linkcode centerSizeFactors} - no additional centering is performed here.
 * If `null`, size factors are computed from the centered column sums of `x`.
 * @param {boolean} [options.log=true] - Whether to perform log-transformation.
 * @param {boolean} [options.allowZeros=false] - Whether size factors of zero should be allowed.
 * If `true`, size factors of zero are converted to the smallest non-zero size factor across all cells.
 * If `false`, an error is raised instead.
 * @param {boolean} [options.allowZeros=false] - Whether non-finite size factors should be allowed.
 * If `true`, size factors of infinity or NaN are converted to the largest non-zero size factor in the dataset or 1, respectively.
 * If `false`, an error is raised instead.
 *
 * @return {ScranMatrix} A matrix of the same type as `x` containing normalized expression values.
 * If `log = true`, the values in the matrix are log-transformed.
 */
export function normalizeCounts(x, options = {}) {
    const { sizeFactors = null, log = true, allowZeros = false, allowNonFinite = false, ...others } = options;
    utils.checkOtherOptions(others);

    var sf_data;
    var output;

    try {
        if (sizeFactors !== null) {
            sf_data = utils.wasmifyArray(sizeFactors, "Float64WasmArray");
            if (sf_data.length != x.numberOfColumns()) {
                throw new Error("length of 'sizeFactors' must be equal to number of columns in 'x'");
            }
        } else {
            sf_data = utils.createFloat64WasmArray(x.numberOfColumns());
            wasm.call(module => module.library_size_factors(x.matrix, sf_data.offset));
            wasm.call(module => module.center_size_factors(sf_data.length, sf_data.offset, false, 0, true)); // assume unblocked in the default case.
        }

        output = gc.call(
            module => module.normalize_counts(x.matrix, sf_data.offset, log, allowZeros, allowNonFinite),
            x.constructor
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(sf_data);
    }
    
    return output;
}

/**
 * Center size factors in preparation for log-transformation.
 * This is usually called by {@linkcode normalizeCounts} internally, but can also be directly called by users to reconstitute the size factors used in the log-normalized matrix.
 *
 * @param {TypedArray|WasmArray} sizeFactors - Array of non-negative size factors, one per cell.
 * @param {object} [options={}] - Optional parameters.
 * @param {?(Int32WasmArray|Array|TypedArray)} [options.block=null] - Array containing the block assignment for each cell, see {@linkcode normalizeCounts}.
 * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
 * If `false`, a Float64WasmArray is returned instead.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output size factors.
 * Length should be equal to that of `sizeFactors`.
 * If `null`, an array is allocated by the function.
 *
 * @return {Float64Array|Float64WasmArray} Array containing the centered size factors.
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function centerSizeFactors(sizeFactors, options = {}) {
    let { block = null, asTypedArray = true, buffer = null, toLowestBlock = true, ...others } = options;
    utils.checkOtherOptions(others);

    let local_buffer = null;
    let block_data;

    try {
        if (buffer === null) {
            local_buffer = utils.createFloat64WasmArray(sizeFactors.length);
            buffer = local_buffer;
        }

        if (buffer !== sizeFactors) {
            buffer.set(sizeFactors instanceof wa.WasmArray ? sizeFactors.array() : sizeFactors);
        }

        var bptr = 0;
        var use_blocks = false;

        if (block !== null) {
            block_data = utils.wasmifyArray(block, "Int32WasmArray");
            if (block_data.length != buffer.length) {
                throw new Error("'block' must be of length equal to that of 'sizeFactors'");
            }
            use_blocks = true;
            bptr = block_data.offset;
        }

        wasm.call(module => module.center_size_factors(buffer.length, buffer.offset, use_blocks, bptr, toLowestBlock));

    } catch(e) {
        utils.free(local_buffer);
        throw e;

    } finally {
        utils.free(block_data);
    }

    return utils.toTypedArray(buffer, local_buffer == null, asTypedArray);
}
