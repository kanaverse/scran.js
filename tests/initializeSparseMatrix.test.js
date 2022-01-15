import * as scran from "../js/index.js";

var vals = new scran.WasmArray(15, "Int32Array");
vals.set([1, 5, 2, 3, 7, 8, 9, 10, 4, 2, 1, 1, 3, 5, 8]);
var indices = new scran.WasmArray(15, "Int32Array");
indices.set([3, 5, 5, 0, 2, 9, 1, 2, 5, 5, 6, 8, 8, 6, 9]);
var indptrs = new scran.WasmArray(11, "Int32Array");
indptrs.set([0, 2, 3, 6, 9, 11, 11, 12, 12, 13, 15]);

console.log(indptrs);
var thing = scran.initializeSparseMatrixFromCompressed(10, 10, vals, indices, indptrs);
console.log(thing.ncol());

var collected = new scran.WasmArray(10, "Float64Array");
thing.column(0, collected.ptr);
console.log(collected.array());

// Because we're effectively inside a promise.
process.exit(0);
