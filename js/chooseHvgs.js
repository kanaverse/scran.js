import * as utils from "./utils.js";
import * as wasm from "./wasm.js";
import { ModelGeneVariancesResults } from "./modelGeneVariances.js";

/**
 * Choose the highly variable genes from variance modelling statistics.
 *
 * @param {(TypedArray|ModelGeneVariancesResults)} x -
 * A TypedArray of statistics, where larger values correspond to higher variability;
 * or a {@linkplain ModelGeneVariancesResults} object, in which case the residuals are used as the statistics.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.number=4000] - Number of highly variable genes to select.
 * @param {number} [options.minimum=0] - Lower bound on the residual to consider for a highly variable gene.
 * By default, a highly variable gene must have a positive residual.
 *
 * @return {Uint8WasmArray} Array of length equal to the number of genes.
 * Highly variable genes are marked with a value of 1 and all other genes have values of zero.
 */
export function chooseHvgs(x, options = {}) {
    const { number = 4000, minimum = 0, ...others } = options;
    utils.checkOtherOptions(others);
    let stat;
    let chosen;

    try {
        if (x instanceof ModelGeneVariancesResults) {
            stat = x.residuals({ copy: "view" });
        } else {
            stat = utils.wasmifyArray(x, "Float64WasmArray");
        }
        chosen = utils.createUint8WasmArray(stat.length);
        wasm.call(module => module.choose_highly_variable_genes(stat.length, stat.offset, chosen.offset, number, minimum));

    } catch (e) {
        chosen.free();
        throw e;
    } finally {
        stat.free();
    }

    return chosen;
}
