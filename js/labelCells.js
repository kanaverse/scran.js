import * as wasm from "./wasm.js";
import * as utils from "./utils.js";

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
 * @param {Uint8Array} matrix - Buffer containing the Gzipped CSV file containing a matrix of ranks.
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
export function loadLabelledReferenceFromBuffers(matrix, markers, labels) {
    var raw;
    var output;
    var matbuf;
    var markbuf;
    var labbuf;

    try {
        matbuf = utils.wasmifyArray(matrix, "Uint8WasmArray");
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
