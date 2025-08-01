import { hypergeometricTest } from "./hypergeometricTest.js";
import * as utils from "./utils.js";

/**
 * Test for gene set enrichment among markers using the {@linkcode hypergeometricTest} function.
 * We assume that all gene names have already been converted into integer indices before running this function;
 * i.e., genes are represented as indices into a "common namespace" consisting of an array of unique gene names.
 * See {@linkcode remapGeneSets} for more details.
 *
 * @param {Array|TypedArray} markers - Array of marker identities.
 * Each entry of the array is a unique integer index identifying a marker gene in the common namespace, where each index lies in `[0, totalGenes)`.
 *
 * In other words, given a common namespace array `X` containing the gene names, the marker names can be obtained as `Array.from(markers).map(i => X[i])`.
 * See {@linkcode remapGeneSets} for more details.
 * @param {Array} geneSets - Array containing the gene sets.
 * Each entry corresponds to a single gene set and may be an Array or TypedArray.
 * Each array should contain unique indices for the genes belonging to the set.
 * 
 * In other words, given a common namespace array `X` containing the gene names, the names of the genes in set `s` can be obtained as `Array.from(geneSets[s]).map(i => X[i])`.
 * See {@linkcode remapGeneSets} for more details.
 * @param {number} totalGenes - Total number of genes in the common namespace. 
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use for computing the p-values, see {@linkcode hypergeometricTest}.
 *
 * @return {object} Object containing:
 *
 * - `count`: Int32Array containing the number of markers present in each set.
 * - `size`: Int32Array containing the size of each set.
 * - `pvalue`: Float64Array containing the p-value for enrichment in each set.
 */
export function testGeneSetEnrichment(markers, geneSets, totalGenes, options = {}) {
    const { numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);

    for (const j of markers) {
        if (j >= totalGenes) {
            throw new Error("'markers' contains out-of-range indices (" + String(j) + ")");
        }
    }
    let is_marker = new Set(markers);

    let nsets = geneSets.length;
    let intersection = new Int32Array(nsets);
    let set_sizes = new Int32Array(nsets);

    for (var i = 0; i < nsets; i++) {
        let current = geneSets[i];
        let present = 0;
        let set_size = 0;

        for (const j of current) {
            if (j >= totalGenes) {
                throw new Error("gene set " + String(i) + " contains out-of-range indices (" + String(j) + ")");
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
        pvalue: hypergeometricTest(intersection, is_marker.size, set_sizes, totalGenes, { numberOfThreads })
    };
}

/**
 * Remap gene sets from a "reference" gene namespace to a "target" namespace.
 * This involves defining a common namespace consisting of gene names that are shared in both namespaces,
 * and then mapping the gene sets to the common namespace.
 *
 * The `target_indices` property returned by this function should be used to generate the indices of `markers=` in {@linkcode testGeneSetEnrichment}.
 * This is typically done by extracting the relevant marker statistics for all genes in the common namespace,
 * and then choosing the top markers with {@linkcode chooseTopMarkers}:
 * 
 * ```
 * let stats = marker_stats.auc(0); // statistics for all genes, typically from scran.scoreMarkers().
 * let stats_common = []; // subset to the statistics for genes in the common namespace.
 * target_indices.forEach(x => { stats_common_namespace.push(stats[x]); });
 * let markers_common = scran.chooseTopMarkers(stats_common, 1000);
 * ```
 *
 * The `sets` property returned by this function can be directly used as `geneSets=` in {@linkcode testGeneSetEnrichment}
 *
 * @param {Array} targetGenes - Array of strings containing the gene names in the target namespace.
 * Any `null` entries are considered to be incomparable.
 * @param {Array} referenceGenes - Array of strings containing the gene names in the reference namespace.
 * Any `null` entries are considered to be incomparable.
 * @param {Array} referenceGeneSets - Array of gene sets.
 * Each entry corresponds to a set and is an Array/TypedArray containing integer indices of genes belonging to that set.
 * Indices are relative to `referenceGenes`.
 *
 * @return {object} Object containing:
 *
 * - `target_indices`: an Int32Array of length equal to the size of the common namespace.
 *   Each entry is an index into `targetGenes` to identify the gene in the common namespace,
 *   i.e., the common namespace can be defined as `Array.from(target_indices).map(i => targetGenes[i])`.
 * - `reference_indices`: an Int32Array of length equal to the size of the common namespace.
 *   Each entry is an index into `referenceGenes` to identify the gene in the common namespace.
 *   i.e., the common namespace can be defined as `Array.from(reference_indices).map(i => referenceGenes[i])`
 *   (which is guaranteed to be the same as the corresponding operation on `target_indices`).
 * - `sets`: an Array of Int32Arrays containing the membership of each gene set.
 *   Each integer is an index into the common namespace defined by `target_indices` and `reference_indices`.
 */
export function remapGeneSets(targetGenes, referenceGenes, referenceGeneSets) {
    let valid = new Map;
    for (var i = 0; i < targetGenes.length; i++) {
        if (targetGenes[i] !== null) {
            valid.set(targetGenes[i], i);
        }
    }

    let data_indices = [];
    let ref_map = new Map;
    for (var i = 0; i < referenceGenes.length; i++) {
        let x = referenceGenes[i];
        if (x !== null) {
            let y = valid.get(x);
            if (typeof y === "number") {
                ref_map.set(i, data_indices.length);
                data_indices.push(y);
            }
        }
    }

    let new_sets = [];
    for (const set of referenceGeneSets) {
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
