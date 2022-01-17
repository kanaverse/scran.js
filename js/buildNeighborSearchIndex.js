import * as utils from "./utils.js";
import Module from "./Module.js";
import { PCAResults } from "./runPCA.js";

/** 
 * Wrapper for the neighbor search index on the Wasm heap.
 */
export class NeighborSearchIndex {
    /**
     * @param {Object} raw Search index on the Wasm heap.
     *
     * Not to be called directly by developers;
     * use `buildNeighborSearchIndex()` instead.
     */
    constructor(raw) {
        this.index = raw;
        return;
    }

    /**
     * @return Frees the memory allocated on the Wasm heap for this object.
     * This invalidates this object and all references to it.
     */
    free() {
        this.index.delete();
        this.index = null;
        return;
    }
}

/**
 * Build the nearest neighbor search index.
 *
 * @param {(PCAResults|Float64WasmArray|Array|TypedArray)} x Numeric coordinates of each cell in the dataset.
 * For array inputs, this is expected to be in column-major format where the rows are the variables and the columns are the cells.
 * For a `PCAResults` input, we use the principal components directly.
 * @param {number} ndim Number of variables/dimensions per cell.
 * Only used for array-like `x`.
 * @param {number} ncells Number of cells.
 * Only used for array-like `x`.
 * @param {boolean} approximate Whether to build an index for an approximate neighbor search.
 *
 * @return A `NeighborSearchIndex` object to use for neighbor searches.
 */
export function buildNeighborSearchIndex(x, ndim = null, ncells = null, approximate = true) {
    var buffer;
    var raw;
    var output;

    try {
        let pptr;

        if (x instanceof PCAResults) {
            ndim = x.numberOfPCs();
            ncells = x.numberOfCells();
            let pcs = x.principalComponents(false);
            pptr = pcs.byteOffset;

        } else {
            if (ndim === null || ncells === null) {
                throw "'ndim' and 'ncells' must be specified when 'x' is an Array";
            }

            buffer = utils.wasmifyArray(x, "Float64WasmArray");
            if (buffer.length != ndim * ncells) {
                throw "length of 'x' must be the product of 'ndim' and 'ncells'";
            }

            pptr = buffer.offset;
        }

        raw = utils.wrapModuleCall(() => Module.build_neighbor_index(pptr, ndim, ncells, approximate)); 
        output = new NeighborSearchIndex(raw);

    } catch (e) {
        utils.free(raw);
        throw e;

    } finally {
        utils.free(buffer);
    }

    return output;
}

