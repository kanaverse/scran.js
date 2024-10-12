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
 * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
 * If `false`, a Float64WasmArray is returned instead.
 * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output.
 * If not `null`, this should have the same length as any of the array-like arguments.
 * @param {boolean} [options.log=false] - Whether to compute log-probabilities.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {Float64Array|Float64WasmArray} An array of length equal to that of the supplied arrays (or 1, if no arrays are supplied).
 * The i-th entry contains the p-value for enrichment computed using the i-th entry of each supplied array. 
 * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
 */
export function hypergeometricTest(markersInSet, numberOfMarkers, geneSetSize, numberOfGenes, options = {}) {
    let { asTypedArray = true, buffer = null, log = false, numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);

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

    let tmp = null;
    try {
        markersInSet_data = utils.wasmifyArray(markersInSet, "Int32WasmArray");
        numberOfMarkers_data = utils.wasmifyArray(numberOfMarkers, "Int32WasmArray");
        geneSetSize_data = utils.wasmifyArray(geneSetSize, "Int32WasmArray");
        numberOfGenes_data = utils.wasmifyArray(numberOfGenes, "Int32WasmArray");

        if (buffer == null) {
            buffer = utils.createFloat64WasmArray(ntests);
            tmp = buffer;
        }

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
            buffer.offset,
            log,
            nthreads
        ));

    } finally {
        utils.free(markersInSet_data);
        utils.free(numberOfMarkers_data);
        utils.free(geneSetSize_data);
        utils.free(numberOfGenes_data);
    }

    return utils.toTypedArray(buffer, tmp == null, asTypedArray);
}
