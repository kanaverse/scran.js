import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";
import * as wa from "wasmarrays.js";
import * as init from "./initializeSparseMatrix.js";

/**************************************************
 **************************************************/

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

function register_features(features, id_array) {
    let registry_contents = new Map;

    // All features in the data are guaranteed to get the a unique ID,
    // but only non-null and non-duplicated (or the first of a duplicate set)
    // are actually registered.
    for (var i = 0; i < features.length; i++) {
        let id = features[i];
        if (id !== null) {
            if (!registry_contents.has(id)) {
                registry_contents.set(id, i);
            }
        }
        id_array[i] = i;
    }

    return { contents: registry_contents, counter: features.length };
}

function convert_features(features, registry, id_array) {  
    let used = new Set;
    let set = (id, index) => {
        let found = registry.contents.get(id);
        if (typeof found !== "undefined") {
            if (!used.has(found)) { // if entries of 'features' match to the same ID, only the first entry gets to match to the ID.
                id_array[index] = found;
                used.add(found);
                return true;
            }
        }
        return false;
    };

    let counter = registry.counter;
    for (var i = 0; i < features.length; i++) {
        let y = features[i];
        let found = false;

        if (y !== null) {
            if (y instanceof Array) {
                for (const z of y) {
                    if (set(z, i)) { // if an entry of 'features' has multiple names, the first matching name wins.
                        found = true;
                        break;
                    }
                }
            } else {
                found = set(y, i);
            }
        }

        // If something isn't found, they get a unique ID.
        if (!found) {
            id_array[i] = counter;
            ++counter;
        }
    }

    return;
}

/**
 * Build the reference dataset for annotation.
 * The build process involves harmonizing the identities of the features available in the test dataset compared to the reference.
 * Specifically, a feature must be present in both datasets in order to be retained. 
 * Of those features in the intersection, only the `top` markers from each pairwise comparison are ultimately used for classification.
 *
 * Needless to say, `features` should match up to the rows of the {@linkplain ScranMatrix} that is actually used for annotation in {@linkcode labelCells}.
 *
 * @param {Array} features - An array of feature identifiers (usually strings) of length equal to the number of rows in the test matrix.
 * Each entry should contain the identifier for the corresponding row of the test matrix.
 * Any `null` entries are considered to be incomparable.
 * If any identifiers are duplicated, only the first occurrence is used and the rest are ignored.
 * @param {LoadLabelledReferenceResults} loaded - A reference dataset, typically loaded with {@linkcode loadLabelledReferenceFromBuffers}.
 * @param {Array} referenceFeatures - An array of feature identifiers (usually strings) of length equal to the number of features in `reference`.
 * Each entry may also be an array of synonymous identifiers, in which case the first identifier that matches to an entry of `features` is used.
 * Contents of `referenceFeatures` are expected to exhibit some overlap with identifiers in `features`.
 * Any `null` entries are considered to be incomparable.
 * If multiple entries of `referenceFeatures` match to the same feature in `features`, only the first matching entry is used and the rest are ignored.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.top=20] - Number of top marker features to use.
 * These features are taken from each pairwise comparison between labels.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {BuildLabelledReferenceResults} Object containing the built reference dataset.
 */
export function buildLabelledReference(features, loaded, referenceFeatures, { top = 20, numberOfThreads = null } = {}) {
    var mat_id_buffer;
    var ref_id_buffer;
    var output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        var nfeat = features.length;
        mat_id_buffer = utils.createInt32WasmArray(nfeat);
        ref_id_buffer = utils.createInt32WasmArray(loaded.numberOfFeatures());
        if (referenceFeatures.length != ref_id_buffer.length) {
            throw new Error("length of 'referenceFeatures' should be equal to the number of features in 'reference'");
        }

        let registry = register_features(features, mat_id_buffer.array());
        convert_features(referenceFeatures, registry, ref_id_buffer.array());

        output = gc.call(
            module => module.build_singlepp_reference(nfeat, mat_id_buffer.offset, loaded.reference, ref_id_buffer.offset, top, nthreads),
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

/**************************************************
 **************************************************/

/**
 * Wrapper around the cell labelling results on the Wasm heap, typically produced by {@linkcode labelCells}.
 * @hideconstructor
 */
class LabelCellsResults {
    #id;
    #results;
    #cell_buffer;
    #label_buffer;

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
     *
     * @return {Int32Array|Int32WasmArray} Array of length equal to the number of cells,
     * containing the index of the best label for each cell.
     */
    predictedLabels({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.get_best(), copy);
    }

    /**
     * @param {number} i - Index of the cell of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     * Only used if `buffer` is not supplied.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output.
     * This should have the same length as the {@linkcode LabelCellsResults#numberOfLabels numberOfLabels}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the scores for this cell across all labels.
     * If `buffer` is supplied, it is used as the return value.
     */
    scoresForCell(i, { copy = true, buffer = null } = {}) {
        if (buffer == null) {
            if (typeof this.#cell_buffer == "undefined") {
                this.#cell_buffer = utils.createFloat64WasmArray(this.#results.num_labels());
            }
            this.#results.get_scores_for_sample(i, this.#cell_buffer.offset);
            return utils.possibleCopy(this.#cell_buffer.array(), copy);
        } else {
            if (buffer.length !== this.#results.num_labels()) {
                throw new Error("length of 'buffer' should equal the number of labels");
            }
            this.#results.get_scores_for_sample(i, buffer.offset);
            return buffer;
        }
    }

    /**
     * @param {number} i - Index of the label of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     * Only used if `buffer` is not supplied.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output.
     * This should have the same length as the {@linkcode LabelCellsResults#numberOfCells numberOfCells}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the scores across all cells for this label.
     * If `buffer` is supplied, it is used as the return value.
     */
    scoresForLabel(i, { copy = true, buffer = null } = {}) {
        if (buffer == null) {
            if (typeof this.#label_buffer == "undefined") {
                this.#label_buffer = utils.createFloat64WasmArray(this.#results.num_samples());
            }
            this.#results.get_scores_for_label(i, this.#label_buffer.offset);
            return utils.possibleCopy(this.#label_buffer.array(), copy);
        } else {
            if (buffer.length !== this.#results.num_samples()) {
                throw new Error("length of 'buffer' should equal the number of cells");
            }
            this.#results.get_scores_for_label(i, buffer.offset);
            return utils.possibleCopy(this.#label_buffer.array(), copy);
        }
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of cells,
     * containing the difference in scores between the best and second-best label during fine-tuning.
     */
    fineTuningDelta({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.get_delta(), copy);
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        if (this.#results !== null) {
            gc.release(this.#id);
            this.#results = null;

            utils.free(this.#label_buffer);
            utils.free(this.#cell_buffer);
        }
    }
}

function label_cells(x, expectedNumberOfFeatures, numberOfFeatures, numberOfCells, FUN, msg) {
    var output = null;
    var matbuf;
    var tempmat;

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

        if (target.nrow() != expectedNumberOfFeatures) {
            throw new Error("number of rows in 'x' should be equal to length of 'features' used to build '" + msg + "'");
        }

        output = FUN(target);

    } finally {
        utils.free(matbuf);
        utils.free(tempmat);
    }

    return output;
}

/**
 * Label cells based on similarity in expression to a reference dataset.
 *
 * @param {(ScranMatrix|Float64WasmArray)} x - The count matrix, or log-normalized matrix, containing features in the rows and cells in the columns.
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
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);
    let FUN = (target, ptr) => {
        return gc.call(module => module.run_singlepp(target, reference.reference, quantile, nthreads), LabelCellsResults);
    };
    return label_cells(x, reference.expectedNumberOfFeatures, numberOfFeatures, numberOfCells, FUN, "reference");
}

/**************************************************
 **************************************************/

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
 * Each entry should contain a single identifier for the corresponding row of the test matrix.
 * Any `null` entries are considered to be incomparable.
 * If any entries are duplicated, only the first occurrence is used and the rest are ignored.
 * @param {Array} loaded - Array of {@linkplain LabelledReference} objects, typically created with {@linkcode loadLabelledReferenceFromBuffers}.
 * @param {Array} referenceFeatures - Array of length equal to `loaded`, 
 * containing arrays of feature identifiers (usually strings) of length equal to the number of features the corresponding entry of `loaded`.
 * Each entry may also be an array of synonymous identifiers, in which case the first identifier that matches to an entry of `features` is used.
 * Contents of `referenceFeatures` are expected to exhibit some overlap with identifiers in `features`.
 * Any `null` entries are considered to be incomparable.
 * If multiple entries of `referenceFeatures` match to the same feature in `features`, only the first matching entry is used and the rest are ignored.
 * @param {Array} reference - Array of {@linkplain BuildLabelledReferenceResults} objects, typically generated by calling {@linkcode buildLabelledReference} 
 * on the same `features` and the corresponding entries of `loaded` and `referenceFeatures`.
 * This should have length equal to that of `loaded`.
 * @param {object} [options={}] - Optional parameters.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {IntegrateLabelledReferencesResults} Object containing the integrated references.
 */
export function integrateLabelledReferences(features, loaded, referenceFeatures, built, { numberOfThreads = null } = {}) {
    let id_arr;
    let loaded_arr2;
    let ref_arr2;
    let built_arr2;
    let output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

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
        let registry = register_features(features, id_arr.array());

        loaded_arr2 = utils.createBigUint64WasmArray(nrefs);
        let la2 = loaded_arr2.array();
        for (var i = 0; i < nrefs; i++) {
            la2[i] = BigInt(loaded[i].reference.$$.ptr);
        }

        ref_arr2 = utils.createBigUint64WasmArray(nrefs);
        let ra2 = ref_arr2.array();
        for (var i = 0; i < nrefs; i++) {
            let current = referenceFeatures[i];
            ref_arr[i] = utils.createInt32WasmArray(current.length);
            convert_features(current, registry, ref_arr[i].array());
            ra2[i] = BigInt(ref_arr[i].offset);
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
                built_arr2.offset,
                nthreads
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
 * Wrapper around the integrated cell labelling results on the Wasm heap, typically produced by {@linkcode labelCells}.
 * @hideconstructor
 */
class IntegrateCellLabelsResults {
    #results;

    constructor(raw) {
        this.#results = raw;
        return;
    }

    /**
     * @return {number} Number of labels used in {@linkcode integrateCellLabels}.
     */
    numberOfReferences() {
        return this.#results.numberOfLabels();
    }

    /**
     * @return {number} Number of cells that were labelled.
     */
    numberOfCells() {
        return this.#results.numberOfCells();
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     *
     * @return {Int32Array|Int32WasmArray} Array of length equal to the number of cells,
     * containing the index of the best reference for each cell.
     */
    predictedReferences({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.predictedLabels(), copy);
    }

    /**
     * @param {number} i - Index of the cell of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     * Only used if `buffer` is not supplied.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output.
     * This should have the same length as the {@linkcode LabelCellsResults#numberOfLabels numberOfLabels}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the scores for this cell across all references.
     * If `buffer` is supplied, it is used as the return value.
     */
    scoresForCell(i, { copy = true, buffer = null } = {}) {
        return this.#results.scoresForCell(i, { copy, buffer });
    }

    /**
     * @param {number} i - Index of the reference of interest.
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     * Only used if `buffer` is not supplied.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output.
     * This should have the same length as the {@linkcode LabelCellsResults#numberOfCells numberOfCells}.
     *
     * @return {Float64Array|Float64WasmArray} Array containing the scores across all cells for this label.
     * If `buffer` is supplied, it is used as the return value.
     */
    scoresForReference(i, { copy = true, buffer = null } = {}) {
        return this.#results.scoresForLabel(i, { copy, buffer });
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean|string} [options.copy=true] - Copying mode, see {@linkcode possibleCopy} for details.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of cells,
     * containing the difference in scores between the best and second-best reference during fine-tuning.
     */
    fineTuningDelta({ copy = true } = {}) {
        return utils.possibleCopy(this.#results.fineTuningDelta(), copy);
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
 * @param {IntegratedLabelledReferences} integrated - An integrated set of reference datasets, typically generated by {@linkcode integrateLabelledReferences}.
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
 * @return {LabelCellsResults} Integrated labelling results for each cell in `x`.
 */
export function integrateCellLabels(x, assigned, integrated, { numberOfFeatures = null, numberOfCells = null, quantile = 0.8, numberOfThreads = null } = {}) { 
    let nrefs = integrated.numberOfReferences();
    if (assigned.length != nrefs) {
        throw new Error("length of 'assigned' should be equal to the number of references in 'integrated'");
    }

    let output;
    let aptrs;
    let assigned_arrs = new Array(nrefs);
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        aptrs = utils.createBigUint64WasmArray(nrefs);
        let aptrs_arr = aptrs.array();
        for (var i = 0; i < assigned.length; i++) {
            let current = assigned[i];

            if (current instanceof LabelCellsResults) {
                current = current.predictedLabels({ copy: "view" });
            }

            let fail = false;
            if (x instanceof ScranMatrix) {
                if (current.length != x.numberOfColumns()) {
                    fail = true;
                }
            } else if (current.length != numberOfCells) {
                fail = true;
            }
            if (fail) {
                throw new Error("length of each element in 'assigned' should be equal to number of columns in 'x'");
            }

            assigned_arrs[i] = utils.wasmifyArray(current, "Int32WasmArray");
            aptrs_arr[i] = BigInt(assigned_arrs[i].offset);
        }
    
        let FUN = (target, ptr) => {
            return gc.call(module => module.integrate_singlepp(target, aptrs_arr.offset, integrated.integrated, quantile, nthreads), LabelCellsResults);
        };
        output = label_cells(x, integrated.expectedNumberOfFeatures, numberOfFeatures, numberOfCells, FUN, "integrated");

    } finally{
        utils.free(aptrs);
        for (const x of assigned_arrs) {
            utils.free(x);
        }
    }

    return new IntegrateCellLabelsResults(output);
}
