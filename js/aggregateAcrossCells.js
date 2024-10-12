import * as gc from "./gc.js";
import * as utils from "./utils.js";
import { ScranMatrix } from "./ScranMatrix.js";

/**
 * Wrapper for the cell aggregation results, produced by {@linkcode aggregateAcrossCells}.
 * @hideconstructor
 */
export class AggregateAcrossCellsResults {
    #id;
    #results;

    constructor(id, raw) {
        this.#id = id;
        this.#results = raw;
        return;
    }

    /**
     * @return {number} Number of groups.
     */
    numberOfGroups() {
        return this.#results.num_groups();
    }

    /**
     * @return {number} Number of genes.
     */
    numberOfGenes() {
        return this.#results.num_genes();
    }

    /**
     * @param {number} group - Index of the group.
     * This should be non-negative and less than {@linkcode AggregateAcrossCellsResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {(string|boolean)} [options.copy=true] - Copying mode to use, see {@linkcode possibleCopy} for details.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes, containing the per-gene sum of values across across all cells in the specified `group`.
     * If `average = true` in {@linkcode aggregateAcrossCells}, each element is the mean value instead.
     */
    groupSums(group, options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.group_sums(group), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
     * If `false`, a Float64WasmArray is returned instead.
     * @param {?Float64WasmArray} [options.buffer=null] - Buffer in which to store the output.
     * If not `null`, this should have the same length as the product of {@linkcode AggregateAcrossCellsResults#numberOfGenes numberOfGenes} 
     * and {@linkcode AggregateAcrossCellsResults#numberOfGroups numberOfGroups}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the product of the number of genes and groups.
     * This can be treated as a column-major matrix where the rows are the genes and the columns are the groups,
     * and each element is the sum of values for the corresponding gene in the corresponding group.
     * If `average = true` in {@linkcode aggregateAcrossCells}, each element is the mean value instead.
     * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
     */
    allSums(options = {}) {
        let { asTypedArray = true, buffer = null, ...others } = options;
        utils.checkOtherOptions(others);
        let tmp = null;

        try {
            if (buffer == null) {
                tmp = utils.createFloat64WasmArray(this.numberOfGenes() * this.numberOfGroups());
                buffer = tmp;
            }
            this.#results.all_sums(buffer.offset);
        } catch (e) {
            utils.free(tmp);
            throw e;
        }

        return utils.toTypedArray(buffer, tmp == null, asTypedArray);
    }

    /**
     * @param {number} group - Index of the group.
     * This should be non-negative and less than {@linkcode AggregateAcrossCellsResults#numberOfGroups numberOfGroups}.
     * @param {object} [options={}] - Optional parameters.
     * @param {(string|boolean)} [options.copy=true] - Copying mode to use, see {@linkcode possibleCopy} for details.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the number of genes, containing the number of cells with detected expression for each gene in the specified `group`.
     * If `average = true` in {@linkcode aggregateAcrossCells}, each element is the proportion of detected cells instead.
     */
    groupDetected(group, options = {}) {
        const { copy = true, ...others } = options;
        utils.checkOtherOptions(others);
        return utils.possibleCopy(this.#results.group_detected(group), copy);
    }

    /**
     * @param {object} [options={}] - Optional parameters.
     * @param {boolean} [options.asTypedArray=true] - Whether to return a Float64Array.
     * If `false`, a Float64WasmArray is returned instead.
     * If not `null`, this should have the same length as the product of {@linkcode AggregateAcrossCellsResults#numberOfGenes numberOfGenes} 
     * and {@linkcode AggregateAcrossCellsResults#numberOfGroups numberOfGroups}.
     *
     * @return {Float64Array|Float64WasmArray} Array of length equal to the product of the number of genes and groups.
     * This can be treated as a column-major matrix where the rows are the genes and the columns are the groups,
     * and each element contains the number of detected cells for the corresponding gene in the corresponding group.
     * If `average = true` in {@linkcode aggregateAcrossCells}, each element is the proportion of detected cells instead.
     * If `buffer` is supplied, the function returns `buffer` if `asTypedArray = false`, or a view on `buffer` if `asTypedArray = true`.
     */
    allDetected(options = {}) {
        let { asTypedArray = true, buffer = null, ...others } = options;
        utils.checkOtherOptions(others);
        let tmp = null;

        try {
            if (buffer == null) {
                tmp = utils.createFloat64WasmArray(this.numberOfGenes() * this.numberOfGroups());
                buffer = tmp;
            }
            this.#results.all_detected(buffer.offset);
        } catch (e) {
            utils.free(tmp);
            throw e;
        }

        return utils.toTypedArray(buffer, tmp == null, asTypedArray);
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
        return;
    }
}

/**
 * Aggregate per-cell expression profiles for each group of cells.
 * This is typically used to summarize data into per-cluster expression profiles for easier inspection.
 *
 * @param {ScranMatrix} x - Some expression matrix, typically containing normalized log-expression values.
 * @param {Int32Array|Int32WasmArray} groups - Array containing group IDs for each cell.
 * This should have length equal to the number of cells and contain all values from 0 to `n - 1` at least once, where `n` is the number of groups.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.average=null] - Whether to compute the average within each group for each statistic.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {AggregateAcrossCellsResults} Object containing the aggregation results.
 */
export function aggregateAcrossCells(x, groups, options = {}) {
    const { average = false, numberOfThreads = null, ...others } = options;
    utils.checkOtherOptions(others);
    var group_data;
    var output;
    let nthreads = utils.chooseNumberOfThreads(numberOfThreads);

    try {
        group_data = utils.wasmifyArray(groups, "Int32WasmArray");
        if (group_data.length != x.numberOfColumns()) {
            throw new Error("length of 'groups' should be equal to number of columns in 'x'");
        }

        output = gc.call(
            module => module.aggregate_across_cells(x.matrix, group_data.offset, average, nthreads),
            AggregateAcrossCellsResults 
        );

    } catch (e) {
        utils.free(output);
        throw e;

    } finally {
        utils.free(group_data);
    }

    return output;
}
