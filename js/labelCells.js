import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";
import * as wa from "wasmarrays.js";
import * as init from "./initializeSparseMatrix.js";

/**************************************************
 **************************************************/

/**
 * Wrapper around a labelled reference dataset on the Wasm heap, typically produced by {@linkcode loadLabelCellsReferenceFromBuffers}.
 * @hideconstructor
 */
class LoadedLabelCellsReference {
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
 * Load a reference dataset for annotation in {@linkecode labelCells}.
 * The reference should be represented by several files, the contents of which are described in the [**singlepp_loaders** documentation](https://github.com/SingleR-inc/singlepp_loaders).
 * 
 * @param {Uint8Array|Uint8WasmArray} ranks - Buffer containing the Gzipped CSV file containing a matrix of ranks.
 * Each line corresponds to a sample and contains a comma-separated vector of ranks across all features.
 * All lines should contain the same number of entries.
 * This is effectively a row-major matrix where rows are samples and columns are features.
 * (Advanced users may note that this is transposed in C++.) 
 * @param {Uint8Array|Uint8WasmArray} markers - Buffer containing the Gzipped GMT file containing the markers for each pairwise comparison between labels.
 * For `markers`, the GMT format is a tab-separated file with possibly variable numbers of fields for each line.
 * Each line corresponds to a pairwise comparison between labels, defined by the first two fields.
 * The remaining fields should contain indices of marker features (referring to columns of `matrix`) that are upregulated in the first label when compared to the second.
 * Markers should be sorted in order of decreasing strength.
 * @param {Uint8Array|Uint8WasmArray} labels - Buffer containing the Gzipped text file containing the label for each sample.
 * Each line should contain an integer representing a particular label, from `[0, N)` where `N` is the number of unique labels.
 * The number of lines should be equal to the number of rows in `matrix`.
 * The actual names of the labels are usually held elsewhere.
 * 
 * @return {LoadedLabelCellsReference} Object containing the reference dataset.
 */
export function loadLabelCellsReferenceFromBuffers(ranks, markers, labels) {
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
            LoadedLabelCellsReference
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

/**************************************************
 **************************************************/

/**
 * Wrapper around a built labelled reference dataset on the Wasm heap, typically produced by {@linkcode trainLabelCellsReference}.
 * @hideconstructor
 */
class TrainedLabelCellsReference {
    #id;
    #reference;

    constructor(id, raw, expected_features) {
        this.#id = id;
        this.#reference = raw;
        this.expectedNumberOfFeatures = expected_features;
        return;
    }

    // internal use only.
    get reference() {
        return this.#reference;
    }

    /**
     * @return {number} Number of shared features between the test and reference datasets.
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

function intersectFeatures(testFeatures, referenceFeatures) {
    let registry = new Map;

    for (var i = 0; i < testFeatures.length; i++) {
        let id = testFeatures[i];
        if (id !== null && !registry.has(id)) { // first hit gets the preference.
            registry.set(id, i);
        }
    }

    let tkeep = [], rkeep = [];
    for (var i = 0; i < referenceFeatures.length; i++) {
        let id = referenceFeatures[i];
        if (id == null) {
            continue;
        }

        if (!Array.isArray(id)) {
            if (registry.has(id)) {
                tkeep.push(registry.get(id));
                registry.delete(id); // deleting to avoid a future match to the same ID, as the intersection must be unique in its first/second hits.
                rkeep.push(i);
            }

        } else { // otherwise, it's an array of multiple synonymous gene names.
            for (const xid of id) {
                if (registry.has(xid)) {
                    tkeep.push(registry.get(xid));
                    registry.delete(xid);
                    rkeep.push(i);
                    break;
                }
            }
        }
    }

    return { "test": tkeep, "reference": rkeep };
}

/**
 * Train a reference dataset for annotation in {@linkcode labelCells}.
 * The build process involves harmonizing the identities of the features available in the test dataset compared to the reference.
 * Specifically, a feature must be present in both datasets in order to be retained. 
 * Of those features in the intersection, only the `top` markers from each pairwise comparison are ultimately used for classification.
 *
 * Needless to say, `testFeatures` should match up to the rows of the {@linkplain ScranMatrix} that is actually used for annotation in {@linkcode labelCells}.
 *
 * @param {Array} testFeatures - An array of feature identifiers (usually strings) of length equal to the number of rows in the test matrix.
 * Each entry should contain the identifier for the corresponding row of the test matrix.
 * Any `null` entries are considered to be incomparable.
 * @param {LoadedLabelCellsReference} loadedReference - A reference dataset, typically loaded with {@linkcode loadLabelCellsReferenceFromBuffers}.
 * @param {Array} referenceFeatures - An array of feature identifiers (usually strings) of length equal to the number of features in `reference`.
 * Each entry may also be an array of synonymous identifiers, in which case the first identifier that matches to an entry of `features` is used.
 * Contents of `referenceFeatures` are expected to exhibit some overlap with identifiers in `testFeatures`.
 * Any `null` entries are considered to be incomparable.
 * If multiple entries of `referenceFeatures` match to the same feature in `features`, only the first matching entry is used and the rest are ignored.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.top=20] - Number of top marker features to use.
 * These features are taken from each pairwise comparison between labels.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {TrainedLabelCellsReference} Object containing the built reference dataset.
 */
export function trainLabelCellsReference(testFeatures, loadedReference, referenceFeatures, { top = 20, numberOfThreads = null } = {}) {
    var test_id_buffer;
    var ref_id_buffer;
    var output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    if (referenceFeatures.length != loadedReference.numberOfFeatures()) {
        throw new Error("length of 'referenceFeatures' should be equal to the number of features in 'loadedReference'");
    }
    const intersection = intersectFeatures(testFeatures, referenceFeatures);

    try {
        test_id_buffer = utils.wasmifyArray(intersection.test, "Int32WasmArray");
        ref_id_buffer = utils.wasmifyArray(intersection.reference, "Int32WasmArray");
        output = gc.call(
            module => module.train_singlepp_reference(
                test_id_buffer.length,
                test_id_buffer.offset,
                ref_id_buffer.offset,
                loadedReference.reference,
                top,
                nthreads
            ),
            TrainedLabelCellsReference,
            testFeatures.length
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(test_id_buffer);
        utils.free(ref_id_buffer);
    }

    return output;
}

/**************************************************
 **************************************************/

/**
 * Wrapper around the cell labelling results on the Wasm heap, typically produced by {@linkcode labelCells}.
 * @hideconstructor
 */
class LabelCellsResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @return {number} Number of labels used in {@linkcode labelCells}.
     */
    numberOfLabels() {
        return this.#results.num_labels();
    }

    /**
     * @return {number} Number of cells that were labelled.
     */
    numberOfCells() {
        return this.#results.num_samples();
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     * @return {Int32Array|Int32WasmArray} Array of length equal to the number of cells,
     * containing the index of the best label for each cell.
     */
    predictedLabels({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.best(), copy);
    }

    /**
     * @param {number} i - Index of the cell of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output.
     * This should have the same length as the {@linkcode LabelCellsResults#numberOfLabels numberOfLabels}.
     * @return {Float64WasmArray} Array containing the scores for this cell across all labels.
     */
    scoresForCell(i, { buffer = null } = {}) {
        let tmp;
        try {
            if (buffer == null) {
                tmp = utils.createFloat64WasmArray(this.#results.num_labels());
                buffer = tmp;
            }
            this.#results.scores_for_sample(i, buffer.offset);
        } catch (e) {
            utils.free(tmp);
            throw e;
        }
        return buffer;
    }

    /**
     * @param {number} i - Index of the label of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     * Only used if `buffer` is not supplied.
     * @return {Float64Array|Float64WasmArray} Array containing the scores across all cells for this label.
     */
    scoresForLabel(i, { copy = true, buffer = null } = {}) {
        return utils.possibleCopy(this.#results.scores_for_label(i), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of cells,
     * containing the difference in scores between the best and second-best label during fine-tuning.
     */
    fineTuningDelta({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.delta(), copy);
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#results !== null) {
            gc.release(this.#id);
            this.#results = null;
        }
    }
}

/**
 * Label cells based on similarity in expression to a reference dataset.
 * This uses the [**SingleR** algorithm](https://github.com/SingleR-inc/singlepp) for cell type annotation.
 *
 * @param {ScranMatrix|Float64WasmArray} x - The count matrix, or log-normalized matrix, containing features in the rows and cells in the columns.
 * If a Float64WasmArray is supplied, it is assumed to contain a column-major dense matrix.
 * @param {BuildLabelledReferenceResults} reference - A built reference dataset, typically generated by {@linkcode buildLabelledReference}.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfFeatures=null] - Number of features, used when `x` is a Float64WasmArray.
 * @param {?number} [options.numberOfCells=null] - Number of cells, used when `x` is a Float64WasmArray.
 * @param {number} [options.quantile=0.8] - Quantile on the correlations to use to compute the score for each label.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {LabelCellsResults} Labelling results for each cell in `x`.
 */
export function labelCells(x, reference, { numberOfFeatures = null, numberOfCells = null, quantile = 0.8, numberOfThreads = null } = {}) {
    var output = null;
    var matbuf;
    var tempmat;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        let target;
        if (x instanceof ScranMatrix) {
            target = x.matrix;
        } else if (x instanceof wa.Float64WasmArray) {
            tempmat = init.initializeDenseMatrixFromDenseArray(numberOfFeatures, numberOfCells, x, { forceInteger: false });
            target = tempmat.matrix;
        } else {
            throw new Error("unknown type for 'x'");
        }

        if (target.nrow() != reference.expectedNumberOfFeatures) {
            throw new Error("number of rows in 'x' should be equal to length of 'features' used to build 'reference'");
        }

        output = gc.call(
            module => module.run_singlepp(target, reference.reference, quantile, nthreads),
            LabelCellsResults
        );
    } finally {
        utils.free(matbuf);
        utils.free(tempmat);
    }

    return output;
}

/**************************************************
 **************************************************/

/**
 * Wrapper around integrated reference datasets on the Wasm heap, typically produced by {@linkcode integrateLabelledReferences}.
 * @hideconstructor
 */
class IntegratedLabelCellsReferences {
    #id;
    #integrated;

    constructor(id, raw, expected_features) {
        this.#id = id;
        this.#integrated = raw;
        this.expectedNumberOfFeatures = expected_features;
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
 * Prepare a classifier that integrates multiple reference datasets.
 * This allows users to choose the best label for a test cell based on its classifications in multiple references.
 *
 * @param {Array} features - An array of feature identifiers (usually strings) of length equal to the number of rows in the test matrix.
 * Each entry should contain a single identifier for the corresponding row of the test matrix.
 * Any `null` entries are considered to be incomparable.
 * If any entries are duplicated, only the first occurrence is used and the rest are ignored.
 * @param {Array} loadedReferences - Array of {@linkplain LoadedLabelCellsReference} objects, typically created with {@linkcode loadLabelCellsReferenceFromBuffers}.
 * @param {Array} referenceFeatures - Array of length equal to `loadedReferences`, 
 * containing arrays of feature identifiers (usually strings) of length equal to the number of features the corresponding entry of `loadedReferences`.
 * Each entry may also be an array of synonymous identifiers, in which case the first identifier that matches to an entry of `testFeatures` is used.
 * Contents of `referenceFeatures` are expected to exhibit some overlap with identifiers in `testFeatures`.
 * Any `null` entries are considered to be incomparable.
 * If multiple entries of `referenceFeatures` match to the same feature in `features`, only the first matching entry is used and the rest are ignored.
 * @param {Array} trainedReferences - Array of {@linkplain TrainedLabelCellsReference} objects, typically generated by calling {@linkcode trainLabelCellsReference} 
 * on the same `testFeatures` and the corresponding entries of `loadedReferences` and `referenceFeatures`.
 * This should have length equal to that of `loaded`.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {IntegratedLabelCellsReference} Object containing the integrated references.
 */
export function integrateLabelCellsReferences(testFeatures, loadedReferences, referenceFeatures, trainedReferences, { numberOfThreads = null } = {}) {
    let interlen_arr;
    let test_id_arr = [];
    let test_id_ptr_arr;
    let ref_id_arr = [];
    let ref_id_ptr_arr;
    let loaded_arr;
    let trained_arr;
    let output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    // Checking the inputs.
    let nrefs = loadedReferences.length;
    if (referenceFeatures.length != nrefs) {
        throw new Error("'loadedReferences' and 'referenceFeatures' should be of the same length");
    }
    if (trainedReferences.length != nrefs) {
        throw new Error("'loadedReferences' and 'trainedReferences' should be of the same length");
    }
    for (var i = 0; i < nrefs; i++) {
        if (loadedReferences[i].numberOfFeatures() != referenceFeatures[i].length) {
            throw new Error("length of each 'referenceFeatures' should be equal to the number of features in the corresponding 'loadedReferences'");
        }
    }

    try {
        for (var i = 0; i < nrefs; i++) {
            const intersection = intersectFeatures(testFeatures, referenceFeatures[i]);
            test_id_arr.push(utils.wasmifyArray(intersection.test, "Int32WasmArray"));
            ref_id_arr.push(utils.wasmifyArray(intersection.reference, "Int32WasmArray"));
        }

        loaded_arr = utils.createBigUint64WasmArray(nrefs);
        trained_arr = utils.createBigUint64WasmArray(nrefs);
        test_id_ptr_arr = utils.createBigUint64WasmArray(nrefs);
        ref_id_ptr_arr = utils.createBigUint64WasmArray(nrefs);
        interlen_arr = utils.createInt32WasmArray(nrefs);
        {
            let la = loaded_arr.array();
            let ta = trained_arr.array(); 
            let tia = test_id_ptr_arr.array();
            let ria = ref_id_ptr_arr.array();
            let ia = interlen_arr.array();
            for (var i = 0; i < nrefs; i++) {
                la[i] = BigInt(loadedReferences[i].reference.$$.ptr);
                ta[i] = BigInt(trainedReferences[i].reference.$$.ptr);
                tia[i] = BigInt(test_id_arr[i].offset);
                ria[i] = BigInt(ref_id_arr[i].offset);
                ia[i] = test_id_arr[i].length;
            }
        }

        output = gc.call(
            module => module.integrate_singlepp_references(
                nrefs,
                interlen_arr.offset,
                test_id_ptr_arr.offset,
                ref_id_ptr_arr.offset,
                loaded_arr.offset,
                trained_arr.offset,
                nthreads
            ),
            IntegratedLabelCellsReferences,
            testFeatures.length
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        for (const x of test_id_arr) {
            utils.free(x);
        }
        for (const x of ref_id_arr) {
            utils.free(x);
        }
        utils.free(test_id_ptr_arr);
        utils.free(ref_id_ptr_arr);
        utils.free(loaded_arr);
        utils.free(trained_arr);
    }

    return output;
}

/**************************************************
 **************************************************/

/**
 * Wrapper around the integrated cell labelling results on the Wasm heap, typically produced by {@linkcode integrateLabelCells}.
 * @hideconstructor
 */
class IntegrateLabelCellsResults {
    #id
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @return {number} Number of labels used in {@linkcode integratedLabelCells}.
     */
    numberOfReferences() {
        return this.#results.num_references();
    }

    /**
     * @return {number} Number of cells that were labelled.
     */
    numberOfCells() {
        return this.#results.num_samples();
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     *
     * @return {Int32Array|Int32WasmArray} Array of length equal to the number of cells,
     * containing the index of the best reference for each cell.
     */
    predictedReferences({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.best(), copy);
    }

    /**
     * @param {number} i - Index of the cell of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output.
     * This should have the same length as the {@linkcode LabelCellsResults#numberOfCells numberOfCells}.
     *
     * @return {Float64WasmArray} Array containing the scores for this cell across all references.
     * If `buffer` is supplied, it is used as the return value.
     */
    scoresForCell(i, { buffer = null } = {}) {
        let tmp;
        try {
            if (buffer == null) {
                tmp = utils.createFloat64WasmArray(this.#results.num_references());
                buffer = tmp;
            }
            this.#results.scores_for_sample(i, buffer.offset);
        } catch (e) {
            utils.free(tmp);
            throw e;
        }
        return buffer;
    }

    /**
     * @param {number} i - Index of the reference of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the scores across all cells for this label.
     */
    scoresForReference(i, { copy = true } = {}) {
        return utils.possibleCopy(this.#results.scores_for_reference(i), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of cells,
     * containing the difference in scores between the best and second-best reference during fine-tuning.
     */
    fineTuningDelta({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.delta(), copy);
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#results !== null) {
            this.#results.free();
            this.#results = null;
        }
    }
}

/**
 * Integrate cell labels across multiple reference datasets.
 *
 * @param {(ScranMatrix|Float64WasmArray)} x - The count matrix, or log-normalized matrix, containing features in the rows and cells in the columns.
 * If a Float64WasmArray is supplied, it is assumed to contain a column-major dense matrix.
 * @param {IntegratedLabelCellsReferences} integrated - An integrated set of reference datasets, typically generated by {@linkcode integrateLabelCellsReferences}.
 * @param {Array} assigned - An array of length equal to the number of references in `integrated`.
 * This should contain the result of classification of `x` with each individual reference via {@linkcode labelCells}.
 * Each element should be a {@linkplain LabelCells} object; or an Array, TypedArray or Int32WasmArray of length equal to the number of cells in `x`.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfFeatures=null] - Number of features, used when `x` is a Float64WasmArray.
 * @param {?number} [options.numberOfCells=null] - Number of cells, used when `x` is a Float64WasmArray.
 * @param {number} [options.quantile=0.8] - Quantile on the correlations to use to compute the score for each label.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {IntegrateLabelCellsResults} Integrated labelling results for each cell in `x`.
 */
export function integrateLabelCells(x, assigned, integrated, { numberOfFeatures = null, numberOfCells = null, quantile = 0.8, numberOfThreads = null } = {}) { 
    let nrefs = integrated.numberOfReferences();
    if (assigned.length != nrefs) {
        throw new Error("length of 'assigned' should be equal to the number of references in 'integrated'");
    }

    let output;
    var matbuf;
    var tempmat;
    let assigned_ptrs;
    let assigned_arrs = new Array(nrefs);
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        let target;
        if (x instanceof ScranMatrix) {
            target = x.matrix;
        } else if (x instanceof wa.Float64WasmArray) {
            tempmat = init.initializeDenseMatrixFromDenseArray(numberOfFeatures, numberOfCells, x, { forceInteger: false });
            target = tempmat.matrix;
        } else {
            throw new Error("unknown type for 'x'");
        }
        if (target.nrow() != integrated.expectedNumberOfFeatures) {
            throw new Error("number of rows in 'x' should be equal to length of 'features' used to build 'reference'");
        }

        assigned_ptrs = utils.createBigUint64WasmArray(nrefs);
        let assigned_ptr_arr = assigned_ptrs.array();
        for (var i = 0; i < assigned.length; i++) {
            let current = assigned[i];
            if (current instanceof LabelCellsResults) {
                current = current.predictedLabels({ copy: "view" });
            }
            if (current.length != x.numberOfColumns()) {
                throw new Error("length of each element in 'assigned' should be equal to number of columns in 'x'");
            }
            assigned_arrs[i] = utils.wasmifyArray(current, "Int32WasmArray");
            assigned_ptr_arr[i] = BigInt(assigned_arrs[i].offset);
        }
    
        output = gc.call(
            module => module.integrate_singlepp(
                target,
                assigned_ptrs.offset,
                integrated.integrated,
                quantile,
                nthreads
            ),
            IntegrateLabelCellsResults
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally{
        utils.free(assigned_ptrs);
        for (const x of assigned_arrs) {
            utils.free(x);
        }
        utils.free(matbuf);
        utils.free(tempmat);
    }

    return output;
}
