import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import { ModelGeneVariancesResults } from "./modelGeneVariances.js";

/**
 * Choose the highly variable genes from variance modelling statistics.
 *
 * @param {TypedArray|ModelGeneVariancesResults} x -
 * A TypedArray of statistics, where larger values correspond to higher variability;
 * or a {@linkplain ModelGeneVariancesResults} object, in which case the residuals are used as the statistics.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.asTypedArray=true] - Whether to return a Uint8Array.
 * If `false`, a Uint8WasmArray is returned instead.
 * @param {?Uint8WasmArray} [options.buffer=null] - Buffer in which to store the output.
 * This should have the same length as `x`.
 * @param {number} [options.number=4000] - Number of highly variable genes to select.
 * @param {number} [options.minimum=0] - Lower bound on the residual to consider for a highly variable gene.
 * By default, a highly variable gene must have a positive residual.
 *
 * @return {Uint8Array|Uint8WasmArray} Array of length equal to the number of genes.
 * Highly variable genes are marked with a value of 1 and all other genes have values of zero.
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function chooseHvgs(x, options = {}) {
    let { asTypedArray = true, buffer = null, number = 4000, minimum = 0, ...others } = options;
    utils.checkOtherOptions(others);
    let stat;
    let tmp = null;

    try {
        if (x instanceof ModelGeneVariancesResults) {
            stat = x.residuals({ copy: "view" });
        } else {
            stat = utils.wasmifyArray(x, "Float64WasmArray");
        }

        if (buffer == null) {
            tmp = utils.createUint8WasmArray(stat.length);
            buffer = tmp;
        }

        wasm.call(module => module.choose_highly_variable_genes(stat.length, stat.offset, buffer.offset, number, minimum));

    } catch (e) {
        utils.free(tmp);
        throw e;
    } finally {
        utils.free(stat);
    }

    return utils.toTypedArray(buffer, tmp == null, asTypedArray);
}
