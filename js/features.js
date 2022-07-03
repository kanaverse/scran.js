import * as permute from "./permute.js";

/**
 * Reorganize feature annotation to match the row identities in a {@linkplain ScranMatrix}.
 * This simpy calls {@linkcode matchVectorToRowIdentities} on each vector.
 *
 * @param {ScranMatrix} x - A {@linkplain ScranMatrix} where the rows might have been reorganized for a more memory-efficient storage order.
 * @param {object} featureInfo - A collection of arrays containing per-feature information (e.g., identifiers).
 * Each array should be parallel to the rows of the original dataset.
 *
 * @return All vectors in `featureInfo` are replaced by their reorganized counterparts,
 * such that entries match the corresponding row in `x`.
 */
export function matchFeatureAnnotationToRowIdentities(x, featureInfo) {
    for (const [key, val] of Object.entries(featureInfo)) {
        featureInfo[key] = permute.matchVectorToRowIdentities(x, val);
    }
    return;
}

// Deprecated, kept around for back-compatibility as of 0.1.1.
export function permuteFeatures(x, featureInfo) {
    return matchFeatureAnnotationToRowIdentities(x, featureInfo);
}

/**
 * Guess the identity of the features from their names.
 *
 * @param {Array} features - Array of strings containing feature identifiers, typically Ensembl IDs or gene symbols.
 * Elements may also be `null` or undefined if an identifier is missing.
 *
 * @return {object} An object containing the inferred `species`, which can be either `"human"` or `"mouse"`;
 * and the identifier `type`, which can be either `"ensembl"` or `"symbol"`.
 * A `confidence` value is reported which defines the percentage of entries in `x` that are consistent with the inferred identity.
 */
export function guessFeatures(features) {
    // Human Ensembl.
    let human_ens = 0
    features.forEach(x => {
        if (x && x.match(/^ENSG[0-9]{11}$/)) {
            human_ens++;
        }
    });

    // Human symbol; starts with upper case, no lower case, and not an Ensembl of any kind.
    let human_sym = 0
    features.forEach(x => {
        if (x && x.match(/^[A-Z][^a-z]+$/) && !x.match(/^ENS[A-Z]+[0-9]{11}/)) {
            human_sym++;
        }
    });

    // Mouse Ensembl.
    let mouse_ens = 0
    features.forEach(x => {
        if (x && x.match(/^ENSMUSG[0-9]{11}$/)) {
            mouse_ens++;
        }
    });

    // Mouse symbol; starts with upper case, but no upper case after that.
    let mouse_sym = 0
    features.forEach(x => {
        if (x && x.match(/^[A-Z][^A-Z]+$/)) {
            mouse_sym++;
        }
    });

    // Who's the highest?
    let output = [
        { "species": "human", "type": "ensembl", "confidence": human_ens},
        { "species": "human", "type": "symbol", "confidence": human_sym},
        { "species": "mouse", "type": "ensembl", "confidence": mouse_ens},
        { "species": "mouse", "type": "symbol", "confidence": mouse_sym}
    ];

    let highest = output[0];
    for (var i = 1; i < output.length; i++) {
        if (output[i].confidence > highest.confidence) {
            highest = output[i];
        }
    }

    highest.confidence /= features.length;
    return highest;
}
