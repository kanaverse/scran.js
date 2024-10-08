import * as utils from "./utils.js";
import * as wasm from "./wasm.js";

/** 
 * Perform a hypergeometric test, typically for over-enrichment of markers across gene sets.
 * This can be computed for multiple gene sets by providing arrays as some or all of the arguments.
 * If multiple arrays are supplied, they must be of the same length.
 *
 * @param {number|Array|TypedArray|WasmArray} markersInSet - Number of detected markers that are also in the gene set.
 * @param {number|Array|TypedArray|WasmArray} numberOfMarkers - Total number of detected markers.
 * @param {number|Array|TypedArray|WasmArray} geneSetSize - Size of the gene set.
 * @param {number|Array|TypedArray|WasmArray} numberOfGenes - Total number of genes.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.log=false] - Whether to compute log-probabilities.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {Float64WasmArray} An array of length equal to that of the supplied arrays (or 1, if no arrays are supplied).
 * The i-th entry contains the p-value for enrichment computed using the i-th entry of each supplied array. 
 */
export function hypergeometricTest(markersInSet, numberOfMarkers, geneSetSize, numberOfGenes, { log = false, numberOfThreads = null } = {}) {
    let markersInSet_data;
    let numberOfMarkers_data;
    let geneSetSize_data;
    let numberOfGenes_data;
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

    if (typeof geneSetSize == "number") {
        geneSetSize = [geneSetSize];
    } else {
        ntests = check_length(geneSetSize, "geneSetSize", ntests);
    }

    if (typeof numberOfGenes == "number") {
        numberOfGenes = [numberOfGenes];
    } else {
        ntests = check_length(numberOfGenes, "numberOfGenes", ntests);
    }

    if (ntests == null) {
        ntests = 1;
    }

    let output;
    try {
        markersInSet_data = utils.wasmifyArray(markersInSet, "Int32WasmArray");
        numberOfMarkers_data = utils.wasmifyArray(numberOfMarkers, "Int32WasmArray");
        geneSetSize_data = utils.wasmifyArray(geneSetSize, "Int32WasmArray");
        numberOfGenes_data = utils.wasmifyArray(numberOfGenes, "Int32WasmArray");
        output = utils.createFloat64WasmArray(ntests);

        wasm.call(module => module.hypergeometric_test(
            ntests, 
            markersInSet_data.length != 1,
            markersInSet_data.offset,
            geneSetSize_data.length != 1,
            geneSetSize_data.offset,
            numberOfMarkers_data.length != 1,
            numberOfMarkers_data.offset,
            numberOfGenes_data.length != 1,
            numberOfGenes_data.offset,
            output.offset,
            log,
            nthreads
        ));

    } finally {
        utils.free(markersInSet_data);
        utils.free(numberOfMarkers_data);
        utils.free(geneSetSize_data);
        utils.free(numberOfGenes_data);
    }

    return output;
}
