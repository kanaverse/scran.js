import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";
import * as wa from "wasmarrays.js";

/**
 * Wrapper around a labelled reference dataset on the Wasm heap, typically produced by {@linkcode loadLabelledReferenceFromBuffers}.
 * @hideconstructor
 */
class LoadLabelledReferenceResults {
    #id;
    #reference;

    constructor(id, raw) {
        this.#id = id;
        this.#reference = raw;
        return;
    }

    // Internal use only, not documented.
    get reference() {
        return this.#reference;
    }

    /**
     * @return {number} Number of samples in this dataset.
     */
    numberOfSamples() {
        return this.#reference.num_samples();
    }

    /**
     * @return {number} Number of features in this dataset.
     */
    numberOfFeatures() {
        return this.#reference.num_features();
    }

    /**
     * @return {number} Number of labels in this dataset.
     */
    numberOfLabels() {
        return this.#reference.num_labels();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#reference !== null) {
            gc.release(this.#id);
            this.#reference = null;
        }
    }
}

/**
 * Load a reference dataset for annotation.
 * 
 * @param {Uint8Array} ranks - Buffer containing the Gzipped CSV file containing a matrix of ranks.
 * Each line corresponds to a sample and contains a comma-separated vector of ranks across all features.
 * All lines should contain the same number of entries.
 * This is effectively a row-major matrix where rows are samples and columns are features.
 * (Advanced users may note that this is transposed in C++.) 
 * @param {Uint8Array} markers - Buffer containing the Gzipped GMT file containing the markers for each pairwise comparison between labels.
 * For `markers`, the GMT format is a tab-separated file with possibly variable numbers of fields for each line.
 * Each line corresponds to a pairwise comparison between labels, defined by the first two fields.
 * The remaining fields should contain indices of marker features (referring to columns of `matrix`) that are upregulated in the first label when compared to the second.
 * Markers should be sorted in order of decreasing strength.
 * @param {Uint8Array} labels - Buffer containing the Gzipped text file containing the label for each sample.
 * Each line should contain an integer representing a particular label, from `[0, N)` where `N` is the number of unique labels.
 * The number of lines should be equal to the number of rows in `matrix`.
 * The actual names of the labels are usually held elsewhere.
 * 
 * @return {LoadLabelledReferenceResults} Object containing the reference dataset.
 */
export function loadLabelledReferenceFromBuffers(ranks, markers, labels) {
    var output;
    var matbuf;
    var markbuf;
    var labbuf;

    try {
        matbuf = utils.wasmifyArray(ranks, "Uint8WasmArray");
        markbuf = utils.wasmifyArray(markers, "Uint8WasmArray");
        labbuf = utils.wasmifyArray(labels, "Uint8WasmArray");
        output = gc.call(
            module => module.load_singlepp_reference(labbuf.offset, labbuf.length, markbuf.offset, markbuf.length, matbuf.offset, matbuf.length),
            LoadLabelledReferenceResults
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(matbuf);
        utils.free(markbuf);
        utils.free(labbuf);
    }

    return output;
}

/**
 * Wrapper around a built labelled reference dataset on the Wasm heap, typically produced by {@linkcode buildLabelledReference}.
 * @hideconstructor
 */
class BuildLabelledReferenceResults {
    #id;
    #reference;

    constructor(id, raw) {
        this.#id = id;
        this.#reference = raw;
        return;
    }

    // internal use only.
    get reference() {
        return this.#reference;
    }

    /**
     * @return {number} Number of shared features between the test and reference datasets.
     */
    sharedFeatures() {
        return this.#reference.shared_features();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#reference !== null) {
            gc.release(this.#id);
            this.#reference = null;
        }
    }
}

function create_feature_availability(features, mat_id_buffer) {
    let mat_id_array = mat_id_buffer.array();
    let available = {};
    let counter = 0;
    features.forEach(y => {
        available[y] = counter;
        mat_id_array[counter] = counter;
        counter++;
    });
    return available;
}

function convert_reference_features(referenceFeatures, available, ref_id_buffer) {  
    let ref_id_array = ref_id_buffer.array();
    let counter = Object.keys(available).length;
    referenceFeatures.forEach((y, i) => {
        if (y in available) {
            ref_id_array[i] = available[y];
        } else {
            ref_id_array[i] = counter;
            counter++;
        }
    });
    return;
}

/**
 * Build the reference dataset for annotation.
 * The build process involves harmonizing the identities of the features available in the test dataset compared to the reference.
 * Specifically, a feature must be present in both datasets in order to be retained. 
 * Of those features in the intersection, only the `top` markers from each pairwise comparison are ultimately used for classification.
 *
 * Needless to say, `features` should match up to the rows of the matrix that is actually used for annotation in {@linkcode labelCells}.
 * If the test dataset is a {@linkplain ScranMatrix}, `features` should already be reorganized to match its row identities (see {@linkcode matchVectorToRowIdentities}).
 * Otherwise the row indices will not be correct in subsequent calls to {@linkcode labelCells} with a {@linkplain ScranMatrix} input. 
 *
 * @param {Array} features - An array of feature identifiers (usually strings) of length equal to the number of rows in the test matrix.
 * Each entry should contain the identifier for the corresponding row of the test matrix.
 * @param {LoadLabelledReferenceResults} loaded - A reference dataset, typically loaded with {@linkcode loadLabelledReferenceFromBuffers}.
 * @param {Array} referenceFeatures - An array of feature identifiers (usually strings) of length equal to the number of features in `reference`.
 * This is expected to exhibit some overlap with those in `features`.
 * @param {object} [options] - Optional parameters.
 * @param {number} [options.top=20] - Number of top marker features to use.
 * These features are taken from each pairwise comparison between labels.
 *
 * @return {BuildLabelledReferenceResults} Object containing the built reference dataset.
 */
export function buildLabelledReference(features, loaded, referenceFeatures, { top = 20 } = {}) {
    var mat_id_buffer;
    var ref_id_buffer;
    var output;

    try {
        var nfeat = features.length;
        mat_id_buffer = utils.createInt32WasmArray(nfeat);
        ref_id_buffer = utils.createInt32WasmArray(loaded.numberOfFeatures());
        if (referenceFeatures.length != ref_id_buffer.length) {
            throw new Error("length of 'referenceFeatures' should be equal to the number of features in 'reference'");
        }

        let available = create_feature_availability(features, mat_id_buffer);
        convert_reference_features(referenceFeatures, available, ref_id_buffer);

        output = gc.call(
            module => module.build_singlepp_reference(nfeat, mat_id_buffer.offset, loaded.reference, ref_id_buffer.offset, top),
            BuildLabelledReferenceResults
        );

        output.expectedNumberOfFeatures = nfeat;

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(mat_id_buffer);
        utils.free(ref_id_buffer);
    }

    return output;
}

function label_cells(x, expectedNumberOfFeatures, buffer, numberOfFeatures, numberOfCells, FUN, msg) {
    var output;
    var matbuf;
    var tempmat;
    var tempbuf;
    let use_buffer = (buffer instanceof wa.Int32WasmArray);

    try {
        let target;
        if (x instanceof ScranMatrix) {
            target = x.matrix;
        } else if (x instanceof wa.Float64WasmArray) {
            if (x.length !== numberOfFeatures * numberOfCells) {
                throw new Error("length of 'x' must be equal to the product of 'numberOfFeatures' and 'numberOfCells'");
            }

            // This will either create a cheap view, or it'll clone
            // 'x' into the appropriate memory space.
            matbuf = utils.wasmifyArray(x, null);
            tempmat = wasm.call(module => module.initialize_dense_matrix(numberOfFeatures, numberOfCells, matbuf.offset, "Float64Array"));
            target = tempmat;
        } else {
            throw new Error("unknown type for 'x'");
        }

        if (target.nrow() != expectedNumberOfFeatures) {
            throw new Error("number of rows in 'x' should be equal to length of 'features' used to build '" + msg + "'");
        }

        let ptr;
        if (!use_buffer) {
            tempbuf = utils.createInt32WasmArray(target.ncol());
            ptr = tempbuf.offset;
        } else {
            ptr = buffer.offset;
        }

        FUN(target, ptr);
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

/**
 * Label cells based on similarity in expression to a reference dataset.
 *
 * @param {(ScranMatrix|Float64WasmArray)} x - The count matrix, or log-normalized matrix, containing features in the rows and cells in the columns.
 * If a Float64WasmArray is supplied, it is assumed to contain a column-major dense matrix.
 * @param {BuildLabelledReferenceResults} reference - A built reference dataset, typically generated by {@linkcode buildLabelledReference}.
 * @param {object} [options] - Optional parameters.
 * @param {Int32WasmArray} [options.buffer=null] - An existing buffer to store the output labels, of length equal to the number of columns in `x`.
 * @param {number} [options.numberOfFeatures=null] - Number of features, used when `x` is a Float64WasmArray.
 * @param {number} [options.numberOfCells=null] - Number of cells, used when `x` is a Float64WasmArray.
 * @param {number} [options.quantile=0.8] - Quantile on the correlations to use to compute the score for each label.
 *
 * @return {Int32Array} Array containing the labels for each cell in `x`.
 * If `buffer` is supplied, the returned array is a view into it.
 */
export function labelCells(x, reference, { buffer = null, numberOfFeatures = null, numberOfCells = null, quantile = 0.8 } = {}) {
    let FUN = (target, ptr) => {
        wasm.call(module => module.run_singlepp(target, reference.reference, quantile, ptr));
    };
    return label_cells(x, reference.expectedNumberOfFeatures, buffer, numberOfFeatures, numberOfCells, FUN, "reference");
}

/**
 * Wrapper around integrated reference datasets on the Wasm heap, typically produced by {@linkcode integrateLabelledReferences}.
 * @hideconstructor
 */
class IntegrateLabelledReferencesResults {
    #id;
    #integrated;

    constructor(id, raw) {
        this.#id = id;
        this.#integrated = raw;
        return;
    }

    // Internal use only, not documented.
    get integrated() {
        return this.#integrated;
    }

    /**
     * @return {number} Number of reference datasets.
     */
    numberOfReferences() {
        return this.#integrated.num_references();
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#integrated !== null) {
            gc.release(this.#id);
            this.#integrated = null;
        }
    }
}

/**
 * Integrate multiple reference datasets.
 *
 * @param {Array} features - An array of feature identifiers (usually strings) of length equal to the number of rows in the test matrix.
 * Each entry should contain the identifier for the corresponding row of the test matrix.
 * @param {Array} loaded - Array of {@linkplain LabelledReference} objects, typically created with {@linkcode loadLabelledReferenceFromBuffers}.
 * @param {Array} referenceFeatures - Array of length equal to `loaded`, 
 * containing arrays of feature identifiers (usually strings) of length equal to the number of features the corresponding entry of `loaded`.
 * This is expected to exhibit some overlap with those in `features`.
 * @param {Array} reference - Array of {@linkplain BuildLabelledReferenceResults} objects, typically generated by {@linkcode buildLabelledReference}.
 * This should have length equal to that of `loaded`.
 *
 * @return {IntegrateLabelledReferencesResults} Object containing the integrated references.
 */
export function integrateLabelledReferences(features, loaded, referenceFeatures, built) {
    let id_arr;
    let loaded_arr2;
    let ref_arr2;
    let built_arr2;
    let output;

    // Checking the inputs.
    let nrefs = loaded.length;
    if (referenceFeatures.length != nrefs) {
        throw new Error("'loaded' and 'referenceFeatures' should be of the same length");
    }
    if (built.length != nrefs) {
        throw new Error("'loaded' and 'built' should be of the same length");
    }
    for (var i = 0; i < nrefs; i++) {
        if (loaded[i].numberOfFeatures() != referenceFeatures[i].length) {
            throw new Error("length of each 'referenceFeatures' should be equal to the number of features in the corresponding 'loaded'");
        }
    }

    let ref_arr = new Array(nrefs);

    try {
        id_arr = utils.createInt32WasmArray(features.length);
        let available = create_feature_availability(features, id_arr);

        loaded_arr2 = utils.createBigUint64WasmArray(nrefs);
        let la2 = loaded_arr2.array();
        for (var i = 0; i < nrefs; i++) {
            la2[i] = BigInt(loaded[i].reference.$$.ptr);
        }

        ref_arr2 = utils.createBigUint64WasmArray(nrefs);
        let ra2 = ref_arr2.array();
        for (var i = 0; i < nrefs; i++) {
            let current = referenceFeatures[i];
            if (current instanceof wa.Int32WasmArray) {
                ra2[i] = BigInt(current.offset);
            } else {
                ref_arr[i] = utils.createInt32WasmArray(current.length);
                convert_reference_features(current, available, ref_arr[i]);
                ra2[i] = BigInt(ref_arr[i].offset);
            }
        }

        built_arr2 = utils.createBigUint64WasmArray(nrefs);
        let ba2 = built_arr2.array();
        for (var i = 0; i < nrefs; i++) {
            ba2[i] = BigInt(built[i].reference.$$.ptr);
        }
        
        output = gc.call(
            module => module.integrate_singlepp_references(
                features.length,
                id_arr.offset,
                nrefs,
                loaded_arr2.offset,
                ref_arr2.offset,
                built_arr2.offset
            ),
            IntegrateLabelledReferencesResults
        );

        output.expectedNumberOfFeatures = features.length;

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(id_arr);
        utils.free(loaded_arr2);
        utils.free(built_arr2);
        utils.free(ref_arr2);
        for (const x of ref_arr) {
            utils.free(x);
        }
    }

    return output;
}

/**
 * Label cells based on similarity in expression to a reference dataset.
 *
 * @param {(ScranMatrix|Float64WasmArray)} x - The count matrix, or log-normalized matrix, containing features in the rows and cells in the columns.
 * If a Float64WasmArray is supplied, it is assumed to contain a column-major dense matrix.
 * @param {IntegratedLabelledReferences} integrated - An integrated set of reference datasets, typically generated by {@linkcode integrateLabelledReferences}.
 * @param {Array} assigned - An array of length equal to the number of references in `integrated`.
 * This should contain the result of classification of `x` with each individual reference via {@linkcode labelCells}.
 * Each element should be an Array, TypedArray or Int32WasmArray of length equal to the number of cells in `x`.
 * @param {object} [options] - Optional parameters.
 * @param {Int32WasmArray} [options.buffer=null] - An existing buffer to store the output labels, of length equal to the number of columns in `x`.
 * @param {number} [options.numberOfFeatures=null] - Number of features, used when `x` is a Float64WasmArray.
 * @param {number} [options.numberOfCells=null] - Number of cells, used when `x` is a Float64WasmArray.
 * @param {number} [options.quantile=0.8] - Quantile on the correlations to use to compute the score for each label.
 *
 * @return {Int32Array} Array containing the best reference for each cell in `x`.
 * If `buffer` is supplied, the returned array is a view into it.
 */
export function integrateCellLabels(x, assigned, integrated, { buffer = null, numberOfFeatures = null, numberOfCells = null, quantile = 0.8 } = {}) { 
    let nrefs = integrated.numberOfReferences();
    if (assigned.length != nrefs) {
        throw new Error("length of 'assigned' should be equal to the number of references in 'integrated'");
    }

    let output;
    let aptrs;
    let assigned_arrs = new Array(nrefs);

    try {
        aptrs = utils.createBigUint64WasmArray(nrefs);
        let aptrs_arr = aptrs.array();
        for (var i = 0; i < assigned.length; i++) {
            let current = assigned[i];

            let fail = false;
            if (x instanceof ScranMatrix) {
                if (current.length != x.numberOfColumns()) {
                    fail = true;
                }
            } else if (current.length != numberOfCells) {
                fail = true;
            }
            if (fail) {
                throw new Error("length of each element 'assigned' should be equal to number of columns in 'x'");
            }

            assigned_arrs[i] = utils.wasmifyArray(current, "Int32WasmArray");
            aptrs_arr[i] = BigInt(assigned_arrs[i].offset);
        }
    
        let FUN = (target, ptr) => {
            wasm.call(module => module.integrate_singlepp(target, aptrs_arr.offset, integrated.integrated, quantile, ptr));
        };
        output = label_cells(x, integrated.expectedNumberOfFeatures, buffer, numberOfFeatures, numberOfCells, FUN, "integrated");

    } finally{
        utils.free(aptrs);
        for (const x of assigned_arrs) {
            utils.free(x);
        }
    }

    return output;
}
