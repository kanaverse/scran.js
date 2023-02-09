import { hypergeometricTest } from "./hypergeometricTest.js";
import * as utils from "./utils.js";

/**
 * Test for feature set enrichment among markers using the {@linkcode hypergeometricTest} function.
 * We assume that all features have already been mapped onto integer indices before running this function,
 * i.e., users are responsible for choosing a common namespace between the dataset markers and the feature sets.
 *
 * @param {Array|TypedArray} markers - Array of marker identities.
 *
 * If this is not a Uint8Array, each entry of the array is assumed to be an index identifying a marker feature, where the total number of features must be defined with `totalFeatures`.
 *
 * If this is a Uint8Array, it should be of length equal to the total number of features.
 * Each entry is treated as a true/false value, indicating whether the feature corresponding to that index is a marker.
 * @param {Array} featureSets - Array containing the feature sets.
 * Each entry corresponds to a single feature set and may be a Uint8Array, Array or TypedArray.
 *
 * If a feature set is represented by a non-Uint8Array value, it should contain indices for the features belonging to the set.
 *
 * If the feature set is represented by a Uint8Array, it should be of length equal to the total number of features
 * Each entry of the Uint8Array is treated as a true/false value, indicating whether the feature corresponding to that index belongs to the set.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.totalFeatures=null] - Total number of features in the common namespace.
 * Only required if `markers` is not a Uint8Array.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use for computing the p-values, see {@linkcode hypergeometricTest}.
 *
 * @return {object} Object containing:
 *
 * - `count`: Int32Array containing the number of markers present in each set.
 * - `size`: Int32Array containing the size of each set.
 * - `pvalue`: Float64Array containing the p-value for enrichment in each set.
 */
export function testFeatureSetEnrichment(markers, featureSets, { totalFeatures = null, numberOfThreads = null } = {}) {
    if (!(markers instanceof Uint8Array)) {
        if (totalFeatures == null) {
            throw new Error("'totalFeatures' must be specified if 'markers' is not a Uint8Array");
        }
        let replacement = new Uint8Array(totalFeatures);
        replacement.fill(0);
        for (const x of markers) {
            replacement[x] = 1;
        }
        markers = replacement;
    }

    let num_markers = 0;
    for (const x of markers) {
        if (x) {
            num_markers++;
        }
    }

    let nsets = featureSets.length;
    let intersection = new Int32Array(nsets);
    let set_sizes = new Int32Array(nsets);

    for (var i = 0; i < nsets; i++) {
        let current = featureSets[i];
        let present = 0;
        let set_size = 0;

        if (current instanceof Uint8Array) {
            if (current.length !== markers.length) {
                throw new Error("length of Uint8Array 'featureSets' entries should be equal to the total number of features");
            }
            for (var j = 0; j < current.length; j++) {
                if (current[j]) {
                    if (markers[j]) {
                        present++;
                    }
                    set_size++;
                } 
            }
        } else {
            for (const j of current) {
                if (markers[j]) {
                    present++;
                }
            }
            set_size = current.length;
        }

        intersection[i] = present;
        set_sizes[i] = set_size;
    }

    return {
        count: intersection,
        size: set_sizes,
        pvalue: hypergeometricTest(intersection, num_markers, set_sizes, markers.length, { numberOfThreads })
    };
}
