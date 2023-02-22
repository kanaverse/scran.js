import { hypergeometricTest } from "./hypergeometricTest.js";
import * as utils from "./utils.js";

/**
 * Test for feature set enrichment among markers using the {@linkcode hypergeometricTest} function.
 * We assume that all features have already been mapped onto integer indices before running this function,
 * i.e., users are responsible for choosing a common namespace between the dataset markers and the feature sets (see {@linkcode remapFeatureSets}).
 *
 * @param {Array|TypedArray} markers - Array of marker identities.
 * Each entry of the array is a unique index identifying a marker feature, where the total number of features must be defined with `totalFeatures`.
 * @param {Array} featureSets - Array containing the feature sets.
 * Each entry corresponds to a single feature set and may be an Array or TypedArray.
 * Each array should contain unique indices for the features belonging to the set.
 * @param {number} totalFeatures - Total number of features in the common namespace.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use for computing the p-values, see {@linkcode hypergeometricTest}.
 *
 * @return {object} Object containing:
 *
 * - `count`: Int32Array containing the number of markers present in each set.
 * - `size`: Int32Array containing the size of each set.
 * - `pvalue`: Float64Array containing the p-value for enrichment in each set.
 */
export function testFeatureSetEnrichment(markers, featureSets, totalFeatures, { numberOfThreads = null } = {}) {
    for (const j of markers) {
        if (j >= totalFeatures) {
            throw new Error("'markers' contains out-of-range indices (" + String(j) + ")");
        }
    }
    let is_marker = new Set(markers);

    let nsets = featureSets.length;
    let intersection = new Int32Array(nsets);
    let set_sizes = new Int32Array(nsets);

    for (var i = 0; i < nsets; i++) {
        let current = featureSets[i];
        let present = 0;
        let set_size = 0;

        for (const j of current) {
            if (j >= totalFeatures) {
                throw new Error("feature set " + String(i) + " contains out-of-range indices (" + String(j) + ")");
            }
            if (is_marker.has(j)) {
                present++;
            }
        }

        intersection[i] = present;
        set_sizes[i] = current.length;
    }

    return {
        count: intersection,
        size: set_sizes,
        pvalue: hypergeometricTest(intersection, is_marker.size, set_sizes, totalFeatures, { numberOfThreads })
    };
}

/**
 * Remap feature sets from a "reference" feature namespace to a "target" namespace.
 * This involves defining a common namespace consisting of feature names that are shared in both namespaces,
 * and then mapping the feature sets to the common namespace.
 *
 * @param {Array} targetFeatures - Array of strings containing the feature names in the target namespace.
 * Any `null` entries are considered to be incomparable.
 * @param {Array} referenceFeatures - Array of strings containing the feature names in the reference namespace.
 * Any `null` entries are considered to be incomparable.
 * @param {Array} referenceFeatureSets - Array of feature sets.
 * Each entry corresponds to a set and is an Array/TypedArray containing integer indices of features belonging to that set.
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
        if (targetFeatures[i] !== null) {
            valid.set(targetFeatures[i], i);
        }
    }

    let data_indices = [];
    let ref_map = new Map;
    for (var i = 0; i < referenceFeatures.length; i++) {
        let x = referenceFeatures[i];
        if (x !== null) {
            let y = valid.get(x);
            if (typeof y === "number") {
                ref_map.set(i, data_indices.length);
                data_indices.push(y);
            }
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
