import * as gc from "./gc.js";
import * as wasm from "./wasm.js";
import * as utils from "./utils.js"; 
import { ScranMatrix } from "./ScranMatrix.js";

/**
 * Initialize a sparse matrix from an R object loaded from an RDS file.
 *
 * @param {RdsObject} x - Handle to an object inside an RDS file.
 * This should be an integer/numeric matrix, `dgCMatrix` or `dgTMatrix` object.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.forceInteger=true] - Whether to coerce all elements to integers via truncation.
 * @param {boolean} [options.layered=true] - Whether to create a layered sparse matrix, see [**tatami_layered**](https://github.com/tatami-inc/tatami_layered) for more details.
 * Only used if the R matrix is of an integer type and/or `forceInteger = true`.
 * Setting to `true` assumes that the matrix contains only non-negative integers.
 *
 * @return {ScranMatrix} Matrix containing sparse data.
 */
export function initializeSparseMatrixFromRds(x, options = {}) {
    const { forceInteger = true, layered = true, ...others } = options;
    utils.checkOtherOptions(others);

    var ids = null;
    var output;

    try {
        output = gc.call(
            module => module.initialize_from_rds(x.object.$$.ptr, forceInteger, layered),
            ScranMatrix
        );
    } catch(e) {
        utils.free(output);
        throw e;
    }

    return output;
}
