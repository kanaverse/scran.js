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
     * @param {?number} group - Index of the group.
     * If a number, it should be non-negative and less than {@linkcode AggregateAcrossCellsResults#numberOfGroups numberOfGroups}.
     * This may also be `null` to obtain values for all groups.
     * @param {object} [options={}] - Optional parameters.
     * @param {(string|boolean)} [options.copy=true] - Copying mode to use when `asMatrix = false`, see {@linkcode possibleCopy} for details.
     *
     * @return {Float64Array|Float64WasmArray}
     * If `group` is a number, an array is returned where each entry corresponds to a gene and contains the summed value across all cells in the specified `group`.
     * If {@linkcode aggregateAcrossCells} was run with `average = true`, the array contains the mean value instead of the sum.
     *
     * If `group = null`, an array is returned containing the concatenation of the arrays for all groups.
     * If `copy = "view"`, the output can be used in {@linkcode ScranMatrix#createDenseMatrix ScranMatrix.createDenseMatrix} to create a {@linkcode ScranMatrix} for input into other functions.
     */
    sums(group, { copy = true } = {}) {
        let vec = (group !== null ? this.#results.group_sums(group) : this.#results.all_sums());
        return utils.possibleCopy(vec, copy);
    }

    /**
     * @param {number} group - Index of the group.
     * This should be non-negative and less than {@linkcode AggregateAcrossCellsResults#numberOfGroups numberOfGroups}.
     * This may also be `null` to obtain values for all groups.
     * @param {object} [options={}] - Optional parameters.
     * @param {(string|boolean)} [options.copy=true] - Copying mode to use when `asMatrix = false`, see {@linkcode possibleCopy} for details.
     *
     * @return {Float64Array|Float64WasmArray}
     * If `group` is a number, an array is returned where each entry corresponds to a gene and contains the number of detected cells in the specified `group`.
     * If {@linkcode aggregateAcrossCells} was run with `average = true`, each value is the proportion of cells with detected expression.
     * 
     * If `group = null`, an array is returned containing the concatenation of the arrays for all groups.
     * If `copy = "view"`, the output can be used in {@linkcode ScranMatrix#createDenseMatrix ScranMatrix.createDenseMatrix} to create a {@linkcode ScranMatrix} for input into other functions.
     */
    detected(group, { copy = true } = {}) {
        let vec = (group !== null ? this.#results.group_detected(group) : this.#results.all_detected());
        return utils.possibleCopy(vec, copy);
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
 * @param {boolean} [options.average=false] - Whether to compute the average expression instead of the sum for each group.
 * Similarly, the proportion of detected expression is reported, rather than the number of detected cells in each group.
 * @param {?number} [options.numberOfThreads=null] - Number of threads to use.
 * If `null`, defaults to {@linkcode maximumThreads}.
 *
 * @return {AggregateAcrossCellsResults} Object containing the aggregation results.
 */
export function aggregateAcrossCells(x, groups, { average = false, numberOfThreads = null } = {}) {
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
