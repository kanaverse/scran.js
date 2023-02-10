import { hypergeometricTest } from "./hypergeometricTest.js";
import * as utils from "./utils.js";

/**
 * Test for feature set enrichment among markers using the {@linkcode hypergeometricTest} function.
 * We assume that all features have already been mapped onto integer indices before running this function,
 * i.e., users are responsible for choosing a common namespace between the dataset markers and the feature sets (see {@linkcode remapFeatureSets}).
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

/**
 * Remap feature sets from a "reference" feature namespace to a "target" namespace.
 * This involves defining a common namespace consisting of feature names that are shared in both namespaces,
 * and then mapping the feature sets to the common namespace.
 *
 * @param {Array} targetFeatures - Array of strings containing the feature names in the target namespace.
 * @param {Array} referenceFeatures - Array of strings containing the feature names in the reference namespace.
 * @param {Array} referenceFeatureSets - Array of feature sets.
 * Each entry corresponds to a set and is an Array/TypedArray containing integer indices of features in that set.
 * Indices are relative to `referenceFeatures`.
 *
 * @return {object} Object containing:
 *
 * - `target_indices`: an Int32Array of length equal to the number of common features between `targetFeatures` and `referenceFeatures`.
 *   Each entry is an index into `targetFeatures` to identify the feature in the common namespace,
 *   i.e., the common namespace can be defined as `Array.from(target_indices).map(i => targetFeatures[i])`.
 * - `reference_indices`: an Int32Array of length equal to the size of the common namespace.
 *   Each entry is an index into `referenceFeatures` to identify the feature in the common namespace.
 *   i.e., the common namespace can be defined as `Array.from(reference_indices).map(i => referenceFeatures[i])`
 *   (which is guaranteed to be the same as the corresponding operation on `target_indices`).
 * - `sets`: an Array of Int32Arrays containing the membership of each feature set.
 *   Each integer is an index into `target_indices` or `reference_indices`.
 */
export function remapFeatureSets(targetFeatures, referenceFeatures, referenceFeatureSets) {
    let valid = new Map;
    for (var i = 0; i < targetFeatures.length; i++) {
        valid.set(targetFeatures[i], i);
    }

    let data_indices = [];
    let ref_map = new Map;
    for (var i = 0; i < referenceFeatures.length; i++) {
        let x = referenceFeatures[i];
        let y = valid.get(x);
        if (typeof y === "number") {
            ref_map.set(i, data_indices.length);
            data_indices.push(y);
        }
    }

    let new_sets = [];
    for (const set of referenceFeatureSets) {
        let remapped = [];
        for (const x of set) {
            let y = ref_map.get(x);
            if (typeof y === "number") {
                remapped.push(y);
            }
        }
        new_sets.push(new Int32Array(remapped));
    }

    return { 
        target_indices: new Int32Array(data_indices),
        reference_indices: new Int32Array(ref_map.keys()),
        sets: new_sets
    };
}
