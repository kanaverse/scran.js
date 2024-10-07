import * as utils from "./utils.js";
import * as wasm from "./wasm.js";

/** 
 * Perform a hypergeometric test, typically for over-enrichment of markers across feature sets.
 * This can be computed for multiple feature sets by providing arrays as some or all of the arguments.
 * If multiple arrays are supplied, they must be of the same length.
 *
 * @param {number|Array|TypedArray|WasmArray} markersInSet - Number of detected markers that are also in the feature set.
 * @param {number|Array|TypedArray|WasmArray} numberOfMarkers - Total number of detected markers.
 * @param {number|Array|TypedArray|WasmArray} featureSetSize - Size of the feature set.
 * @param {number|Array|TypedArray|WasmArray} numberOfFeatures - Total number of features.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.log=false] - Whether to compute log-probabilities.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {Float64WasmArray} An array of length equal to that of the supplied arrays (or 1, if no arrays are supplied).
 * The i-th entry contains the p-value for enrichment computed using the i-th entry of each supplied array. 
 */
export function hypergeometricTest(markersInSet, numberOfMarkers, featureSetSize, numberOfFeatures, { log = false, numberOfThreads = null } = {}) {
    let markersInSet_data;
    let numberOfMarkers_data;
    let featureSetSize_data;
    let numberOfFeatures_data;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    let ntests = null;
    let check_length = (candidate, name, sofar) => {
        if (sofar !== null && candidate.length !== sofar) {
            throw new Error("array inputs must have the same length (failing for '" + name + "')");
        }
        return candidate.length;
    }

    if (typeof markersInSet == "number") {
        markersInSet = [markersInSet];
    } else { 
        ntests = check_length(markersInSet, "markersInSet", ntests);
    }

    if (typeof numberOfMarkers == "number") {
        numberOfMarkers = [numberOfMarkers];
    } else {
        ntests = check_length(numberOfMarkers, "numberOfMarkers", ntests);
    }

    if (typeof featureSetSize == "number") {
        featureSetSize = [featureSetSize];
    } else {
        ntests = check_length(featureSetSize, "featureSetSize", ntests);
    }

    if (typeof numberOfFeatures == "number") {
        numberOfFeatures = [numberOfFeatures];
    } else {
        ntests = check_length(numberOfFeatures, "numberOfFeatures", ntests);
    }

    if (ntests == null) {
        ntests = 1;
    }

    let output;
    try {
        markersInSet_data = utils.wasmifyArray(markersInSet, "Int32WasmArray");
        numberOfMarkers_data = utils.wasmifyArray(numberOfMarkers, "Int32WasmArray");
        featureSetSize_data = utils.wasmifyArray(featureSetSize, "Int32WasmArray");
        numberOfFeatures_data = utils.wasmifyArray(numberOfFeatures, "Int32WasmArray");
        output = utils.createFloat64WasmArray(ntests);

        wasm.call(module => module.hypergeometric_test(
            ntests, 
            markersInSet_data.length != 1,
            markersInSet_data.offset,
            featureSetSize_data.length != 1,
            featureSetSize_data.offset,
            numberOfMarkers_data.length != 1,
            numberOfMarkers_data.offset,
            numberOfFeatures_data.length != 1,
            numberOfFeatures_data.offset,
            output.offset,
            log,
            nthreads
        ));

    } finally {
        utils.free(markersInSet_data);
        utils.free(numberOfMarkers_data);
        utils.free(featureSetSize_data);
        utils.free(numberOfFeatures_data);
    }

    return output;
}
