import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { Int32WasmArray } from "./WasmArray.js";
import { LayeredSparseMatrix } from "./SparseMatrix.js";

/**
 * Wrapper around a labelled reference dataset on the Wasm heap.
 */
class LabelledReference {
    /**
     * @param {Object} raw Results allocated on the Wasm heap.
     *
     * This should not be called directly by developers,
     * call `loadReferenceFromBuffers()` instead.
     */
    constructor(raw) {
        this.reference = raw;
        return;
    }

    /**
     * @return Number of samples in this dataset.
     */
    numberOfSamples() {
        return this.reference.num_samples();
    }

    /**
     * @return Number of features in this dataset.
     */
    numberOfFeatures() {
        return this.reference.num_features();
    }

    /**
     * @return Number of labels in this dataset.
     */
    numberOfLabels() {
        return this.reference.num_labels();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.reference !== null) {
            this.reference.delete();
            this.reference = null;
        }
    }
}

/**
 * Load a reference dataset for downstream annotation.
 *
 * @param {Uint8Array} ranks - Buffer containing the Gzipped CSV file containing a matrix of ranks.
 * @param {Uint8Array} markers - Buffer containing the Gzipped GMT file containing the markers for each pairwise comparison between labels.
 * @param {Uint8Array} labels - Buffer containing the Gzipped text file containing the label for each sample.
 * 
 * @return A `LabelledReference` object containing the reference dataset.
 *
 * In `matrix`, each line corresponds to a sample and contains a comma-separated vector of ranks across all features.
 * All lines should contain the same number of entries.
 * This is effectively a row-major matrix where rows are samples and columns are features.
 * (Advanced users may note that this is transposed in C++.) 
 *
 * For `markers`, the GMT format is a tab-separated file with possibly variable numbers of fields for each line.
 * Each line corresponds to a pairwise comparison between labels, defined by the first two fields.
 * The remaining fields should contain indices of marker genes (referring to columns of `matrix`) that are upregulated in the first label when compared to the second.
 * Markers should be sorted in order of decreasing strength.
 *
 * For `labels`, each line should contain an integer representing a particular label, from `[0, N)` where `N` is the number of unique labels.
 * The number of lines should be equal to the number of rows in `matrix`.
 * The actual names of the labels are usually held elsewhere.
 */
export function loadLabelledReferenceFromBuffers(ranks, markers, labels) {
    var raw;
    var output;
    var matbuf;
    var markbuf;
    var labbuf;

    try {
        matbuf = utils.wasmifyArray(ranks, "Uint8WasmArray");
        markbuf = utils.wasmifyArray(markers, "Uint8WasmArray");
        labbuf = utils.wasmifyArray(labels, "Uint8WasmArray");
        raw = wasm.call(module => module.load_singlepp_reference(labbuf.offset, labbuf.length, markbuf.offset, markbuf.length, matbuf.offset, matbuf.length));
        output = new LabelledReference(raw);
    } catch (e) {
        utils.free(raw);
        throw e;
    } finally {
        utils.free(matbuf);
        utils.free(markbuf);
        utils.free(labbuf);
    }

    return output;
}

/**
 * Label cells based on similarity in expression to a reference dataset.
 *
 * @param {SparseMatrix} x - The count matrix, or log-normalized matrix, containing features in the rows and cells in the columns.
 * @param {LabelledReference} reference - A reference dataset, typically constructed with `loadLabelledReferenceFromBuffers`.
 * @param {Object} options - Optional parameters.
 * @param {Int32WasmArray} buffer - A buffer to store the output labels, of length equal to the number of columns in `x`.
 * @param {Array} geneNames - An array of gene identifiers (usually strings) of length equal to the number of rows in `x`.
 * @param {Array} referenceGeneNames - An array of gene identifiers (usually strings) of length equal to the number of features in `reference`.
 * This is expected to exhibit some overlap with those in `geneNames`.
 * @param {number} top - Number of top marker genes to use from each pairwise comparison between labels.
 * @param {number} quantile - Quantile on the correlations to use to compute the score for each label.
 *
 * @return An object is returned containing `usedMarkers`, the number of markers used for classification;
 * and `labels`, an `Int32Array` is returned containing the labels for each cell in `x`.
 * If `buffer` is supplied, `labels` is an array view into it.
 */
export function labelCells(x, reference, { buffer = null, geneNames = null, referenceGeneNames = null, top = 20, quantile = 0.8 } = {}) {
    var ngenes;
    var output;
    let use_buffer = (buffer instanceof Int32WasmArray);
    var mat_id_buffer;
    var ref_id_buffer;

    try {
        if (!use_buffer) {
            buffer = new Int32WasmArray(x.numberOfColumns());
        }

        // Building the set of indices.
        var use_ids = false;
        var mat_id_offset = 0;
        var ref_id_offset = 0;

        if (geneNames !== null || referenceGeneNames !== null) {
            if ((geneNames !== null) != (referenceGeneNames !== null)) {
                throw "both or neither 'geneNames' and 'referenceGeneNames' should be specified";
            }

            mat_id_buffer = new Int32WasmArray(x.numberOfRows());
            ref_id_buffer = new Int32WasmArray(reference.numberOfFeatures());
            let mat_id_array = mat_id_buffer.array();
            let ref_id_array = ref_id_buffer.array();

            if (geneNames.length != mat_id_buffer.length) {
                throw "length of 'geneNames' should be equal to the number of rows in 'x'";
            }
            if (referenceGeneNames.length != ref_id_buffer.length) {
                throw "length of 'referenceGeneNames' should be equal to the number of features in 'reference'";
            }

            let available = {};
            let counter = 0;
            if (x instanceof LayeredSparseMatrix) {
                // Remember, the 'permutation' does not describe the permutation to get _to_ 'x';
                // it describes the permutation to recover the original ordering _from_ 'x'.
                let permutation = x.permutation();
                permutation.forEach((p, i) => {
                    available[geneNames[i]] = counter;
                    mat_id_array[p] = counter;
                    counter++;
                });
            } else {
                geneNames.forEach(y => {
                    available[y] = counter;
                    mat_id_array[counter] = counter;
                    counter++;
                });
            }

            referenceGeneNames.forEach((y, i) => {
                if (y in available) {
                    ref_id_array[i] = available[y];
                } else {
                    available[y] = counter;
                    ref_id_array[i] = counter;
                    counter++;
                }
            });

            use_ids = true;
            mat_id_offset = mat_id_buffer.offset;
            ref_id_offset = ref_id_buffer.offset;

        } else if (x instanceof LayeredSparseMatrix) {
            // This'll get free'd by the ref_id_buffer free.
            let tmp = new Int32WasmArray(reference.numberOfFeatures());

            // Getting the identity of the permuted rows in 'x'.
            mat_id_buffer = new Int32WasmArray(x.numberOfRows());
            let mat_id_array = mat_id_buffer.array();
            let permutation = x.permutation({ buffer: tmp });
            let tmp_array = tmp.array();
            tmp_array.forEach((p, i) => {
                mat_id_array[p] = i;
            }); 

            // Mocking up a counterpart for the reference dataset.
            ref_id_buffer = tmp;
            let ref_id_array = ref_id_buffer.array();
            ref_id_array.forEach((x, i) => {
                ref_id_array[i] = i;
            });

            use_ids = true;
            mat_id_offset = mat_id_buffer.offset;
            ref_id_offset = ref_id_buffer.offset;
        }

        ngenes = wasm.call(module => module.run_singlepp(x.matrix, reference.reference, use_ids, mat_id_offset, ref_id_offset, top, quantile, buffer.offset));
        if (!use_buffer) {
            output = buffer.slice();
        } else {
            output = buffer.array();
        }

    } finally {
        utils.free(mat_id_buffer);
        utils.free(ref_id_buffer);
        if (!use_buffer) {
            utils.free(buffer);
        }
    }
    
    return {
        "usedMarkers": ngenes,
        "labels": output        
    };
}
