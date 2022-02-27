import * as utils from "./utils.js";
import { ModelGeneVarResults } from "./modelGeneVar.js";

/**
 * Choose the highly variable genes from variance modelling statistics.
 *
 * @param {(TypedArray|ModelGeneVarResults)} x -
 * A `TypedArray` of statistics, where larger values correspond to higher variability;
 * or a `ModelGeneVarResults` object, in which case the residuals are used as the statistics.
 * @param {Object} [options] - Optional parameters.
 * @param {number} [options.number] - Number of highly variable genes to select.
 *
 * @return A `Uint8WasmArray` of length equal to the total number of genes,
 * where the chosen highly variable genes are marked with a value of 1 and all other genes have values of zero.
 */
export function chooseHVGs(x, { number = 4000 } = {}) {
    let stat; 
    if (x instanceof ModelGeneVarResults) {
        stat = x.residuals();
    } else {
        stat = x.slice();
    }

    stat.sort();
    let threshold = stat[Math.max(0, stat.length - number)]; 

    let features = utils.createUint8WasmArray(stat.length);
    try {
        // Do this AFTER the features allocation, so that
        // we can set copy = false for the input array.
        if (x instanceof ModelGeneVarResults) {
            stat = x.residuals({ copy: false });
        } else {
            stat = x;
        }

        let farr = features.array();
        stat.forEach((x, i) => {
            farr[i] = x >= threshold;
        });

    } catch (e) {
        features.free();
        throw e;
    }

    return features;
}
