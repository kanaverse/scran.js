import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";
import * as wa from "wasmarrays.js";

/**
 * Compute median-based size factors to remove composition biases.
 * This is similar to the DESeq2 normalization strategy,
 * and the factors can be directly used in {@linkcode logNormCounts}.
 *
 * @param {ScranMatrix} x The count matrix, usually after filtering.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.center=true] - Whether to return centered size factors.
 * If `false`, the size factors can be interpreted as the scaling to match `reference`.
 * @param {?(Array|TypedArray|Float64WasmArray)} [options.reference=null] - Reference profile to normalize against.
 * This should be an array of length equal to the number of rows in `x`.
 * If `null`, this is automatically set to the row means of `x`.
 * @param {?Float64WasmArray} [options.buffer=null] - Output buffer for the size factors.
 * This should have length equal to the number of columns in `x`.
 * @param {number} [options.priorCount=10] Prior count to use for shrinking size factors towards the relative library size.
 * Larger values result in stronger shrinkage when the coverage is low.
 *
 * @return {Float64WasmArray} Array of length equal to the number of columns in `x`, containing the size factors for all cells.
  * If `buffer` is supplied, it is directly filled and returned.
 */
export function medianSizeFactors(x, { center = true, reference = null, buffer = null, priorCount = 10 } = {}) {
    var local_buffer;
    var output;
    var ref_arr;

    try {
        if (!(buffer instanceof wa.Float64WasmArray)) {
            local_buffer = utils.createFloat64WasmArray(x.numberOfColumns());
            output = local_buffer;
        } else {
            if (buffer.length !== x.numberOfColumns()) {
                throw new Error("length of 'buffer' must be equal to the number of columns in 'x'");
            }
            output = buffer;
        }

        let use_ref = (reference !== null)
        let ref_ptr = 0;
        if (use_ref) {
            ref_arr = utils.wasmifyArray(reference, "Float64WasmArray");
            if (ref_arr.length !== x.numberOfRows()) {
                throw new Error("length of 'reference' must be equal to the number of rows in 'x'");
            }
            ref_ptr = ref_arr.offset;
        }

        wasm.call(module => module.median_size_factors(x.matrix, use_ref, ref_ptr, center, priorCount, output.offset));

    } catch (e) {
        utils.free(local_buffer);
        throw e;

    } finally {
        utils.free(ref_arr);
    }
    
    return output;
}
