import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { SparseMatrix } from "./SparseMatrix.js";
import * as wa from "WasmArray";

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
 * Load a reference dataset for annotation.
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
 * The remaining fields should contain indices of marker features (referring to columns of `matrix`) that are upregulated in the first label when compared to the second.
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
 * Wrapper around a built labelled reference dataset on the Wasm heap.
 */
class BuiltLabelledReference {
    /**
     * @param {Object} raw Results allocated on the Wasm heap.
     *
     * This should not be called directly by developers,
     * call `buildLabelledReference()` instead.
     */
    constructor(raw) {
        this.reference = raw;
        return;
    }

    /**
     * @return Number of shared features between the test and reference datasets.
     */
    sharedFeatures() {
        return this.reference.shared_features();
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
 * Build the reference dataset for annotation.
 *
 * @param {Array} features - An array of feature identifiers (usually strings) of length equal to the number of rows in the test matrix.
 * Each entry should contain the identifier for the corresponding row of the test matrix.
 * @param {LabelledReference} loaded - A reference dataset, typically loaded with `loadLabelledReferenceFromBuffers`.
 * @param {Array} referenceFeatures - An array of feature identifiers (usually strings) of length equal to the number of features in `reference`.
 * This is expected to exhibit some overlap with those in `features`.
 * @param {Object} [options] - Optional parameters.
 * @param {number} [options.top] - Number of top marker features to use.
 * These features are taken from each pairwise comparison between labels.
 *
 * @return A `BuiltLabelledReference` object containing the built reference dataset.
 *
 * The build process involves harmonizing the identities of the features available in the test dataset compared to the reference.
 * Specifically, a feature must be present in both datasets in order to be retained. 
 * Of those features in the intersection, only the `top` markers from each pairwise comparison are ultimately used for classification.
 *
 * Needless to say, `features` should match up to the rows of the matrix that is actually used for annotation in `labelCells()`.
 * If the test dataset is a `LayeredSparseMatrix`, the ordering of `features` should include the permutation that was applied during the layering process.
 * Otherwise the row indices will not be correct in subsequent calls to `labelCells()` with a `LayeredSparseMatrix` input. 
 */
export function buildLabelledReference(features, loaded, referenceFeatures, { top = 20 } = {}) {
    var mat_id_buffer;
    var ref_id_buffer;
    var raw;
    var output;

    try {
        var nfeat = features.length;
        mat_id_buffer = utils.createInt32WasmArray(nfeat);
        ref_id_buffer = utils.createInt32WasmArray(loaded.numberOfFeatures());
        let mat_id_array = mat_id_buffer.array();
        let ref_id_array = ref_id_buffer.array();

        if (referenceFeatures.length != ref_id_buffer.length) {
            throw "length of 'referenceFeatures' should be equal to the number of features in 'reference'";
        }

        let available = {};
        let counter = 0;
        features.forEach(y => {
            available[y] = counter;
            mat_id_array[counter] = counter;
            counter++;
        });

        referenceFeatures.forEach((y, i) => {
            if (y in available) {
                ref_id_array[i] = available[y];
            } else {
                available[y] = counter;
                ref_id_array[i] = counter;
                counter++;
            }
        });

        raw = wasm.call(module => module.build_singlepp_reference(nfeat, loaded.reference, mat_id_buffer.offset, ref_id_buffer.offset, top));
        output = new BuiltLabelledReference(raw);
        output.expectedNumberOfFeatures = nfeat;

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(mat_id_buffer);
        utils.free(ref_id_buffer);
    }

    return output;
}

/**
 * Label cells based on similarity in expression to a reference dataset.
 *
 * @param {(SparseMatrix|Float64WasmArray)} x - The count matrix, or log-normalized matrix, containing features in the rows and cells in the columns.
 * If a `Float64WasmArray` is supplied, it is assumed to contain a column-major dense matrix.
 * @param {BuiltLabelledReference} reference - A built reference dataset, typically generated by `buildLabelledReference()`.
 * @param {Object} [options] - Optional parameters.
 * @param {Int32WasmArray} [options.buffer] - A buffer to store the output labels, of length equal to the number of columns in `x`.
 * @param {number} [options.numberOfFeatures] - Number of features, used when `x` is a `Float64WasmArray`.
 * @param {number} [options.numberOfCells] - Number of cells, used when `x` is a `Float64WasmArray`.
 * @param {number} [options.quantile] - Quantile on the correlations to use to compute the score for each label.
 *
 * @return An `Int32Array` is returned containing the labels for each cell in `x`.
 * If `buffer` is supplied, the returned array is a view into it.
 */
export function labelCells(x, reference, { buffer = null, numberOfFeatures = null, numberOfCells = null, quantile = 0.8 } = {}) {
    var output;
    var matbuf;
    var tempmat;
    var tempbuf;
    let use_buffer = (buffer instanceof wa.Int32WasmArray);

    try {
        let target;
        if (x instanceof SparseMatrix) {
            target = x.matrix;
        } else if (x instanceof wa.Float64WasmArray) {
            if (x.length !== numberOfFeatures * numberOfCells) {
                throw "length of 'x' must be equal to the product of 'numberOfFeatures' and 'numberOfCells'";
            }

            // This will either create a cheap view, or it'll clone
            // 'x' into the appropriate memory space.
            matbuf = utils.wasmifyArray(x, null);
            tempmat = wasm.call(module => module.initialize_dense_matrix(numberOfFeatures, numberOfCells, matbuf.offset, "Float64Array"));
            target = tempmat;
        } else {
            throw "unknown type for 'x'";
        }

        if (target.nrow() != reference.expectedNumberOfFeatures) {
            throw "number of rows in 'x' should be equal to length of 'features' used to build 'reference'";
        }

        let ptr;
        if (!use_buffer) {
            tempbuf = utils.createInt32WasmArray(target.ncol());
            ptr = tempbuf.offset;
        } else {
            ptr = buffer.offset;
        }

        wasm.call(module => module.run_singlepp(target, reference.reference, quantile, ptr));
        if (!use_buffer) {
            output = tempbuf.slice();
        } else {
            output = buffer.array();
        }

    } finally {
        utils.free(matbuf);
        utils.free(tempmat);
        utils.free(tempbuf);
    }
    
    return output;
}
