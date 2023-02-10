import * as utils from "./utils.js";
import { ModelGeneVarResults } from "./modelGeneVar.js";

/**
 * Compute the filter threshold required to retain the top `number` values.
 *
 * @param {Array|TypedArray} x - Array of numeric values, typically per-gene statistics.
 * @param {number} number - Number of top values to retain after filtering on the returned threshold.
 * This may be approximate in the presence of ties.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.largest=true] - Whether the top values in `x` are defined as the largest numeric values.
 * If `false`, the top values are considered to be the smallest.
 *
 * @return {number} Threshold to be applied to `x` to obtain the top (approximately) `number` values.
 * If `largest = true`, filtering is performed by taking all values in `x` that are greater than or equal to the returned threshold;
 * if `false`, filtering is performed by taking all values in `x` that are less than or equal to the returned threshold.
 * If `x` is zero-length, NaN is returned.
 */
export function computeTopThreshold(x, number, { largest = true } = {}) {
    if (x instanceof Array) {
        x.sort((a, b) => a - b); // just in case...
    } else {
        x.sort();
    }

    if (x.length == 0) {
        return Number.NaN;
    }

    if (largest) {
        return x[Math.max(0, x.length - number)]; 
    } else {
        return x[Math.min(number, x.length) - 1]; 
    }
}

/**
 * Choose the highly variable genes from variance modelling statistics.
 *
 * @param {(TypedArray|ModelGeneVarResults)} x -
 * A TypedArray of statistics, where larger values correspond to higher variability;
 * or a {@linkplain ModelGeneVarResults} object, in which case the residuals are used as the statistics.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.number=4000] - Number of highly variable genes to select.
 * @param {number} [options.minimum=0] - Minimum value of the residual to consider for a highly variable gene.
 * By default, a highly variable gene must have a non-negative residual.
 *
 * @return {Uint8WasmArray} Array of length equal to the total number of genes,
 * where the chosen highly variable genes are marked with a value of 1 and all other genes have values of zero.
 */
export function chooseHVGs(x, { number = 4000, minimum = 0 } = {}) {
    let stat; 
    if (x instanceof ModelGeneVarResults) {
        stat = x.residuals();
    } else {
        stat = x.slice();
    }

    let threshold = computeTopThreshold(stat, number, { largest: true });
    if (threshold < minimum) {
        threshold = minimum;
    }

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
